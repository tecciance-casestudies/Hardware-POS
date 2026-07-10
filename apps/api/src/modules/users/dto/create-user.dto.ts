import { UserRole } from '@hardware-pos/database';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'pin must be numeric' })
  pin!: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  branchId?: string;
}
