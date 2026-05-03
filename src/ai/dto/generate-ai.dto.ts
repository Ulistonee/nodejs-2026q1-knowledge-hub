import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GenerateAiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32_000)
  prompt!: string;

  @IsOptional()
  @IsUUID('4')
  sessionId?: string;
}
