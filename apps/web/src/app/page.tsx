export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
        Project foundation
      </span>

      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Hardware POS</h1>

      <p className="mt-4 text-lg text-slate-600">
        Cashier sales front-end for hardware retail. QuickBooks Online remains the inventory and
        accounting source of truth.
      </p>

      <button
        type="button"
        className="mt-8 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-700"
      >
        Get started
      </button>

      <p className="mt-6 text-sm text-slate-400">
        Feature screens (login, cart, checkout, sync) are not built yet.
      </p>
    </main>
  );
}
