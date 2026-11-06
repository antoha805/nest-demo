import { InitialSchema1793397800067 } from './1793397800067-InitialSchema';
import { AddAuthorization1793478323281 } from './1793478323281-AddAuthorization';
import { AddPostAuthor1793480324637 } from './1793480324637-AddPostAuthor';
import { AddCommentsAndLikes1793648839376 } from './1793648839376-AddCommentsAndLikes';
import { AddPostCategoryIndex1793653886382 } from './1793653886382-AddPostCategoryIndex';
import { AddCommentsCursorIndex1793654328377 } from './1793654328377-AddCommentsCursorIndex';
import { Migration20261106120000_AdoptMikroOrmNames } from './Migration20261106120000_AdoptMikroOrmNames';
import { Migration20261106130000_DropTypeOrmMigrations } from './Migration20261106130000_DropTypeOrmMigrations';
import { Migration20261106140000_AddUserNickname } from './Migration20261106140000_AddUserNickname';
import { Migration20261106150000_AddNotifications } from './Migration20261106150000_AddNotifications';

// Run in this order. `npm run migration:create` writes new ones, which then have
// to be added at the end.
export const migrations = [
  InitialSchema1793397800067,
  AddAuthorization1793478323281,
  AddPostAuthor1793480324637,
  AddCommentsAndLikes1793648839376,
  AddPostCategoryIndex1793653886382,
  AddCommentsCursorIndex1793654328377,
  Migration20261106120000_AdoptMikroOrmNames,
  Migration20261106130000_DropTypeOrmMigrations,
  Migration20261106140000_AddUserNickname,
  Migration20261106150000_AddNotifications,
];
