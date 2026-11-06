import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PostVisibilityService } from './post-visibility.service';

@Module({
  imports: [CaslModule],
  providers: [PostVisibilityService],
  exports: [PostVisibilityService],
})
export class PostVisibilityModule {}
