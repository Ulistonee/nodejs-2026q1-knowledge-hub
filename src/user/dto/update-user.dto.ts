import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserDto {
  @IsString() @IsNotEmpty() @IsOptional() oldPassword?: string;
  @IsString() @IsNotEmpty() @IsOptional() newPassword?: string;
  @IsEnum(UserRole) @IsOptional() role?: UserRole;
}
