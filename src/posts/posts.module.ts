import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaslModule } from '../casl/casl.module';
import { CategoriesModule } from '../categories/categories.module';
import { Post } from './post.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), CategoriesModule, CaslModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
