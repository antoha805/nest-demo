import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaslModule } from '../casl/casl.module';
import { PostVisibilityService } from './post-visibility.service';
import { Post } from './post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), CaslModule],
  providers: [PostVisibilityService],
  exports: [PostVisibilityService],
})
export class PostVisibilityModule {}
