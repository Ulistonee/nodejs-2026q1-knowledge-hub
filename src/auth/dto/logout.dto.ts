import { Allow, IsOptional } from 'class-validator';

export class LogoutDto {
  @Allow()
  @IsOptional()
  refreshToken?: unknown;
}
