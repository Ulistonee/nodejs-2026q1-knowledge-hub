import { IsNotEmpty, IsString } from 'class-validator';

export class SignupDto {
  @IsString() @IsNotEmpty() login: string;
  @IsString() @IsNotEmpty() password: string;
}
