import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsString() @IsNotEmpty() content: string;
  @IsUUID() articleId: string;
  @IsUUID() authorId: string;
}
