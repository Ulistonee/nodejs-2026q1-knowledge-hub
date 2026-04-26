import { IsUUID } from 'class-validator';
import { ListQueryDto } from './list-query.dto';

export class CommentListQueryDto extends ListQueryDto {
  @IsUUID()
  articleId: string;
}
