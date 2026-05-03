import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GenerateAiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32_000)
  prompt: string;
}
