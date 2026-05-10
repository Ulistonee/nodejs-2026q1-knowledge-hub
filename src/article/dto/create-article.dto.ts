import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ArticleStatus } from '../enums/article-status.enum';

export class CreateArticleDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() content: string;
  @IsEnum(ArticleStatus) @IsOptional() status?: ArticleStatus;
  @IsUUID() @IsOptional() authorId?: string;
  @IsUUID() @IsOptional() categoryId?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() tags?: string[];
}
