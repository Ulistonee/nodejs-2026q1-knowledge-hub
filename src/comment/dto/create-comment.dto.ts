import { IsNotEmpty, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  articleId: string;

  @ValidateIf((o) => o.authorId !== null && o.authorId !== undefined)
  @IsUUID()
  authorId?: string | null;
}
