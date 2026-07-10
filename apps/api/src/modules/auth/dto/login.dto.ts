import { IsEmail, IsString, MinLength } from 'class-validator';

/** Admin / accountant / owner email + password login. */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
