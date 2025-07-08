import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Content } from './entities/content.entity';
import { ContentGenre } from './entities/content-genre.entity';
import { Genre } from './entities/genre.entity';
import { Movie } from './entities/movie.entity';
import { SyncStatus } from './entities/sync-status.entity';
import { TvSeason } from './entities/tv-season.entity';
import { TvSeries } from './entities/tv-series.entity';

const entities = [
  Content,
  Movie,
  TvSeries,
  TvSeason,
  Genre,
  ContentGenre,
  SyncStatus,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  exports: [TypeOrmModule],
})
export class ContentModule {}
