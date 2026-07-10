import { IsString, Length, Matches } from 'class-validator';

/** Cashier / manager PIN login. Tenant comes from the `x-tenant-id` header. */
export class PinLoginDto {
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'pin must be numeric' })
  pin!: string;
}
