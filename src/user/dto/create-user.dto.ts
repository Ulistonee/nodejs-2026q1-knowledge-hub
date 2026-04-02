import { IsString, IsNotEmpty } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';
import { IsEnum, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString() @IsNotEmpty() login: string;
  @IsString() @IsNotEmpty() password: string;
  @IsEnum(UserRole) @IsOptional() role?: UserRole;
}