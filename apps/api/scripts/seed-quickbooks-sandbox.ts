/**
 * Seed a QuickBooks Online sandbox with the real product catalog from a
 * "Purchases by Supplier Detail" Excel export.
 *
 * Reads every purchase line, dedupes items by their "Product/Service full name"
 * (preserving the `Parent:Child` hierarchy as QBO categories + sub-items), and
 * creates them as Inventory items: PurchaseCost = most recent purchase Rate,
 * UnitPrice = cost x markup (sales prices are not in a purchases report),
 * QtyOnHand = total purchased quantity.
 *
 * Usage (from the repo root):
 *   pnpm --filter @hardware-pos/api seed:qbo -- <xlsx-path> --dry-run
 *   pnpm --filter @hardware-pos/api seed:qbo -- <xlsx-path> [--tenant tnt_dev]
 *       [--markup 1.25] [--qty <flat-number>] [--limit N]
 *
 * --dry-run parses and prints the plan without touching QBO or the database,
 * so it works before QuickBooks is even connected. Live mode reuses the OAuth
 * tokens stored by the API (connect via the web app's /quickbooks/connect
 * first) and is idempotent: items that already exist in QBO are skipped.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import ExcelJS from 'exceljs';

import { decryptSecret, encryptSecret } from '../src/common/crypto';

// ── CLI args ─────────────────────────────────────────────────────────────────

interface CliOptions {
  xlsxPath: string;
  dryRun: boolean;
  tenantId: string;
  markup: number;
  flatQty: number | null;
  limit: number | null;
}

function parseArgs(argv: string[]): CliOptions {
  const positional: string[] = [];
  const opts: CliOptions = {
    xlsxPath: '',
    dryRun: false,
    tenantId: 'tnt_dev',
    markup: 1.25,
    flatQty: null,
    limit: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue; // pnpm passes the script-arg separator through
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--tenant') opts.tenantId = argv[++i];
    else if (arg === '--markup') opts.markup = Number(argv[++i]);
    else if (arg === '--qty') opts.flatQty = Number(argv[++i]);
    else if (arg === '--limit') opts.limit = Number(argv[++i]);
    else positional.push(arg);
  }
  if (positional.length !== 1) {
    console.error(
      'Usage: seed-quickbooks-sandbox.ts <xlsx-path> [--dry-run] [--tenant id] [--markup 1.25] [--qty N] [--limit N]',
    );
    process.exit(1);
  }
  opts.xlsxPath = positional[0];
  if (!fs.existsSync(opts.xlsxPath)) {
    console.error(`File not found: ${opts.xlsxPath}`);
    process.exit(1);
  }
  if (!Number.isFinite(opts.markup) || opts.markup <= 0) {
    console.error('--markup must be a positive number');
    process.exit(1);
  }
  return opts;
}

// ── Excel parsing ────────────────────────────────────────────────────────────

interface ItemPlan {
  /** Full name as it appears in the report, e.g. "WALL TILE 2*1:… 9122LT GLOSSY". */
  fullName: string;
  /** Category segment before the first colon, if any. */
  parent: string | null;
  /** Item name (child segment), colon-free. */
  name: string;
  description: string | null;
  qtyPurchased: number;
  purchaseCost: number;
  purchaseRows: number;
}

type CellValue = ExcelJS.CellValue;

/** Collapse exceljs cell values (formula results, rich text) to a primitive. */
function plain(v: CellValue): string | number | Date {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as { result?: CellValue; text?: string; richText?: Array<{ text: string }> };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.result != null) return plain(o.result);
    if (o.text != null) return o.text;
    return '';
  }
  return v as string | number;
}

async function parseWorkbook(xlsxPath: string): Promise<ItemPlan[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook has no sheets');

  // Locate the header row and its column positions (report layout is fixed but
  // the leading company-name banner rows make absolute indices fragile).
  let headerRowNumber = 0;
  const col: Record<string, number> = {};
  sheet.eachRow({ includeEmpty: false }, (row, n) => {
    if (headerRowNumber) return;
    const values = (row.values as CellValue[]).slice(1).map(plain);
    const idx = values.findIndex((v) => String(v).trim() === 'Product/Service full name');
    if (idx >= 0) {
      headerRowNumber = n;
      values.forEach((v, i) => {
        col[String(v).trim()] = i;
      });
    }
  });
  if (!headerRowNumber) {
    throw new Error('Could not find the "Product/Service full name" header row');
  }

  interface Accumulator {
    qty: number;
    lastRate: number;
    lastDate: Date;
    description: string | null;
    rows: number;
  }
  const byFullName = new Map<string, Accumulator>();

  sheet.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= headerRowNumber) return;
    const values = (row.values as CellValue[]).slice(1).map(plain);
    const at = (name: string): string | number | Date =>
      col[name] !== undefined ? (values[col[name]] ?? '') : '';

    // Supplier group headers and "Total for …" rows carry text in column 1;
    // expense lines have no product name — skip both.
    const groupLabel = String(values[0] ?? '').trim();
    const fullName = String(at('Product/Service full name')).trim();
    const qty = Number(at('Quantity'));
    const rate = Number(at('Rate'));
    if (groupLabel || !fullName || !Number.isFinite(qty) || !Number.isFinite(rate)) return;

    const rawDate = at('Transaction date');
    const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
    const description = String(at('Description')).trim() || null;

    const acc = byFullName.get(fullName) ?? {
      qty: 0,
      lastRate: rate,
      lastDate: new Date(0),
      description,
      rows: 0,
    };
    acc.qty += qty;
    acc.rows++;
    if (!Number.isNaN(date.getTime()) && date >= acc.lastDate) {
      acc.lastDate = date;
      acc.lastRate = rate;
    }
    if (!acc.description && description) acc.description = description;
    byFullName.set(fullName, acc);
  });

  return [...byFullName.entries()].map(([fullName, acc]) => {
    const colonAt = fullName.indexOf(':');
    const parent = colonAt > 0 ? fullName.slice(0, colonAt).trim() : null;
    // QBO uses ':' as the hierarchy separator, so it can't appear in a name.
    const name = (colonAt > 0 ? fullName.slice(colonAt + 1) : fullName)
      .replaceAll(':', '-')
      .trim()
      .slice(0, 100);
    return {
      fullName,
      parent,
      name,
      description: acc.description,
      qtyPurchased: acc.qty,
      purchaseCost: round2(acc.lastRate),
      purchaseRows: acc.rows,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Environment / connection ────────────────────────────────────────────────

/** Minimal .env loader (dotenv is not a direct dependency of the API). */
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in apps/api/.env`);
    process.exit(1);
  }
  return value;
}

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com';
const PRODUCTION_API_BASE = 'https://quickbooks.api.intuit.com';

interface QboSession {
  apiBase: string;
  realmId: string;
  accessToken: string;
}

// ── QBO API helpers ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function qboFetch(
  session: QboSession,
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${session.apiBase}/v3/company/${session.realmId}${pathAndQuery}`;
  const doFetch = () =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  let res = await doFetch();
  if (res.status === 429) {
    console.log('  Rate limited (429) — waiting 61s before retrying…');
    await sleep(61_000);
    res = await doFetch();
  }
  return res;
}

async function qboQuery<T>(session: QboSession, query: string): Promise<T> {
  const res = await qboFetch(
    session,
    `/query?minorversion=65&query=${encodeURIComponent(query)}`,
  );
  if (!res.ok) {
    throw new Error(`QBO query failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as T;
}

interface QboItemStub {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  Type: string;
}

async function fetchAllItems(session: QboSession): Promise<QboItemStub[]> {
  const items: QboItemStub[] = [];
  for (let start = 1; ; start += 1000) {
    const json = await qboQuery<{ QueryResponse?: { Item?: QboItemStub[] } }>(
      session,
      `select Id, Name, FullyQualifiedName, Type from Item startposition ${start} maxresults 1000`,
    );
    const page = json.QueryResponse?.Item ?? [];
    items.push(...page);
    if (page.length < 1000) return items;
  }
}

interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
}

async function resolveAccounts(
  session: QboSession,
): Promise<{ income: QboAccount; cogs: QboAccount; asset: QboAccount }> {
  const json = await qboQuery<{ QueryResponse?: { Account?: QboAccount[] } }>(
    session,
    'select Id, Name, AccountType, AccountSubType from Account maxresults 1000',
  );
  const accounts = json.QueryResponse?.Account ?? [];
  const income =
    accounts.find((a) => a.AccountSubType === 'SalesOfProductIncome') ??
    accounts.find((a) => a.AccountType === 'Income');
  const cogs =
    accounts.find((a) => a.AccountSubType === 'SuppliesMaterialsCogs') ??
    accounts.find((a) => a.AccountType === 'Cost of Goods Sold');
  const asset =
    accounts.find((a) => a.AccountSubType === 'Inventory') ??
    accounts.find((a) => a.AccountType === 'Other Current Asset');
  if (!income || !cogs || !asset) {
    throw new Error(
      'Sandbox is missing a standard Income / Cost of Goods Sold / Inventory Asset account. ' +
        'Create them in QuickBooks (Chart of Accounts) and re-run.',
    );
  }
  return { income, cogs, asset };
}

async function createQboItem(
  session: QboSession,
  body: Record<string, unknown>,
): Promise<{ Id: string; FullyQualifiedName?: string }> {
  const res = await qboFetch(session, '/item?minorversion=65', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`create failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  const json = (await res.json()) as { Item?: { Id: string; FullyQualifiedName?: string } };
  if (!json.Item?.Id) throw new Error('QBO response did not include an Item Id');
  return json.Item;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  console.log(`Parsing ${path.basename(opts.xlsxPath)}…`);
  let plans = await parseWorkbook(opts.xlsxPath);
  const parents = [...new Set(plans.filter((p) => p.parent).map((p) => p.parent as string))];
  console.log(
    `Found ${plans.length} unique items across ${parents.length} categories ` +
      `(${plans.reduce((n, p) => n + p.purchaseRows, 0)} purchase lines).`,
  );
  if (opts.limit != null) {
    plans = plans.slice(0, opts.limit);
    console.log(`--limit: seeding only the first ${plans.length} items.`);
  }

  if (opts.dryRun) {
    console.log('\n── DRY RUN — nothing will be created ──');
    console.log(`Categories: ${parents.join(' | ') || '(none)'}`);
    console.log(
      `Pricing: PurchaseCost = latest purchase rate, UnitPrice = cost × ${opts.markup}, ` +
        `QtyOnHand = ${opts.flatQty ?? 'total purchased quantity'}\n`,
    );
    const preview = plans.slice(0, 20);
    for (const p of preview) {
      const qty = opts.flatQty ?? p.qtyPurchased;
      console.log(
        `  ${p.parent ? `[${p.parent}] ` : ''}${p.name}` +
          ` — cost ${p.purchaseCost}, price ${round2(p.purchaseCost * opts.markup)}, qty ${qty}` +
          ` (${p.purchaseRows} purchase${p.purchaseRows > 1 ? 's' : ''})`,
      );
    }
    if (plans.length > preview.length) {
      console.log(`  … and ${plans.length - preview.length} more.`);
    }
    console.log('\nRe-run without --dry-run (after connecting QuickBooks) to create these items.');
    return;
  }

  // ── Live mode: reuse the OAuth connection stored by the API ──
  loadEnvFile(path.resolve(__dirname, '../.env'));
  const clientId = requireEnv('QUICKBOOKS_CLIENT_ID');
  const clientSecret = requireEnv('QUICKBOOKS_CLIENT_SECRET');
  const encryptionKey = requireEnv('TOKEN_ENCRYPTION_KEY');

  const { prisma } = await import('@hardware-pos/database');
  const connection = await prisma.quickBooksConnection.findUnique({
    where: { tenantId: opts.tenantId },
  });
  if (!connection || !connection.isActive) {
    console.error(
      `No QuickBooks connection stored for tenant "${opts.tenantId}". ` +
        'Connect first from the web app: /quickbooks/connect.',
    );
    process.exit(1);
  }

  // Always refresh: access tokens last ~1h, and Intuit rotates refresh tokens,
  // so the rotated pair must be persisted back or the stored one goes stale.
  console.log(`Refreshing QuickBooks access token (realm ${connection.realmId})…`);
  const refreshToken = decryptSecret(connection.refreshToken, encryptionKey);
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!tokenRes.ok) {
    console.error(`Token refresh failed (${tokenRes.status}): ${await tokenRes.text()}`);
    process.exit(1);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };
  const now = Date.now();
  await prisma.quickBooksConnection.update({
    where: { tenantId: opts.tenantId },
    data: {
      accessToken: encryptSecret(tokens.access_token, encryptionKey),
      refreshToken: encryptSecret(tokens.refresh_token, encryptionKey),
      accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
    },
  });

  const session: QboSession = {
    apiBase:
      process.env.QUICKBOOKS_API_BASE ??
      (connection.environment === 'production' ? PRODUCTION_API_BASE : SANDBOX_API_BASE),
    realmId: connection.realmId,
    accessToken: tokens.access_token,
  };

  console.log('Resolving standard accounts…');
  const accounts = await resolveAccounts(session);
  console.log(
    `  Income: ${accounts.income.Name} · COGS: ${accounts.cogs.Name} · Asset: ${accounts.asset.Name}`,
  );

  console.log('Listing existing items for idempotency…');
  const existing = await fetchAllItems(session);
  const existingByFqn = new Map(existing.map((i) => [i.FullyQualifiedName.toLowerCase(), i]));
  console.log(`  ${existing.length} items already in the company.`);

  // Pace requests well under the sandbox throttle (~100 req/min).
  const THROTTLE_MS = 650;
  const invStartDate = new Date().toISOString().slice(0, 10);

  // Categories first, so sub-items can reference them.
  const categoryIds = new Map<string, string>();
  for (const parent of parents) {
    const found = existingByFqn.get(parent.toLowerCase());
    if (found) {
      categoryIds.set(parent, found.Id);
      continue;
    }
    await sleep(THROTTLE_MS);
    const created = await createQboItem(session, { Name: parent, Type: 'Category' });
    categoryIds.set(parent, created.Id);
    console.log(`  Category created: ${parent}`);
  }

  let createdCount = 0;
  let skippedCount = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const [index, plan] of plans.entries()) {
    const fqn = (plan.parent ? `${plan.parent}:${plan.name}` : plan.name).toLowerCase();
    if (existingByFqn.has(fqn)) {
      skippedCount++;
      continue;
    }
    const body: Record<string, unknown> = {
      Name: plan.name,
      Type: 'Inventory',
      TrackQtyOnHand: true,
      QtyOnHand: opts.flatQty ?? plan.qtyPurchased,
      InvStartDate: invStartDate,
      PurchaseCost: plan.purchaseCost,
      UnitPrice: round2(plan.purchaseCost * opts.markup),
      IncomeAccountRef: { value: accounts.income.Id },
      ExpenseAccountRef: { value: accounts.cogs.Id },
      AssetAccountRef: { value: accounts.asset.Id },
      ...(plan.description ? { Description: plan.description, PurchaseDesc: plan.description } : {}),
      ...(plan.parent
        ? { SubItem: true, ParentRef: { value: categoryIds.get(plan.parent) as string } }
        : {}),
    };
    await sleep(THROTTLE_MS);
    try {
      await createQboItem(session, body);
      createdCount++;
      if (createdCount % 10 === 0 || index === plans.length - 1) {
        console.log(`  ${createdCount} created / ${skippedCount} skipped (${index + 1}/${plans.length})…`);
      }
    } catch (err) {
      failures.push({ name: plan.fullName, error: (err as Error).message });
      console.warn(`  FAILED: ${plan.fullName} — ${(err as Error).message}`);
    }
  }

  console.log(
    `\nDone. Created ${createdCount}, skipped ${skippedCount} existing, ${failures.length} failed.`,
  );
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }
  console.log('Next: run "Sync Products" in the web app to pull these into the POS.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
