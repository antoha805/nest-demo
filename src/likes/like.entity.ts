import { type Opt, PrimaryKeyProp } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { User } from '../users/user.entity';

export enum LikeableType {
  POST = 'post',
  COMMENT = 'comment',
}

// likeableId cannot have a foreign key, as it points to one of several tables.
// Instead, triggers on those tables delete the likes along with the record.
@Entity({ tableName: 'likes' })
export class Like {
  [PrimaryKeyProp]?: ['likeableType', 'likeableId', 'userId'];

  // The key starts with the target, so it also serves the likesCount subqueries.
  @Enum({
    items: () => LikeableType,
    nativeEnumName: 'likes_likeabletype_enum',
    primary: true,
  })
  likeableType!: LikeableType;

  @PrimaryKey({ type: 'uuid' })
  likeableId!: string;

  @ManyToOne(() => User, {
    fieldName: 'userId',
    mapToPk: true,
    primary: true,
    deleteRule: 'cascade',
    updateRule: 'no action',
  })
  userId!: string;

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt: Opt<Date> = new Date();
}
