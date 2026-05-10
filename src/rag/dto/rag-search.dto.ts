import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;

export class RagSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: (typeof ARTICLE_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  hybrid?: boolean;
}
