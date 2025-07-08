import { Module } from '@nestjs/common';
import { TmdbApiModule } from '../../core/tmdb-api/tmdb-api.module';
import { ContentModule } from '../content/content.module';
import { SyncService } from './sync.service';
import { TaskService } from './task.service';

@Module({
  imports: [ContentModule, TmdbApiModule],
  providers: [SyncService, TaskService],
})
export class WorkerModule {}
