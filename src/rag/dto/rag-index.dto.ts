import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class RagIndexDto {
  @IsOptional()
  @IsBoolean()
  onlyPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  articleIds?: string[];

  @IsOptional()
  @IsISO8601()
  updatedAfter?: string;
}
