import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum LikeableType {
  POST = 'post',
  COMMENT = 'comment',
}

// likeableId cannot have a foreign key, as it points to one of several tables.
// Instead, triggers on those tables delete the likes along with the record.
@Entity('likes')
export class Like {
  // The key starts with the target, so it also serves the likesCount subqueries.
  @PrimaryColumn({ type: 'enum', enum: LikeableType })
  likeableType: LikeableType;

  @PrimaryColumn({ type: 'uuid' })
  likeableId: string;

  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
