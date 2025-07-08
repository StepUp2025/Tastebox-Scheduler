import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TmdbApiService } from './tmdb-api.service';

@Module({
  imports: [HttpModule],
  providers: [TmdbApiService],
  exports: [TmdbApiService],
})
export class TmdbApiModule {}
