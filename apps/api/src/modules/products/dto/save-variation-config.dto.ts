import { IsObject } from 'class-validator';

/**
 * The variation wizard's whole state, persisted verbatim (attributes, price
 * mode, generated variants). The client owns the shape; the server treats it
 * as an opaque document scoped to the product.
 */
export class SaveVariationConfigDto {
  @IsObject()
  config!: Record<string, unknown>;
}
