import { SourceType } from 'src/common/enums/source-type.enum';
import { TvSeasonDetailDto } from 'src/core/tmdb-api/dto/tmdb.dto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { TvSeries } from './tv-series.entity';

@Entity()
@Index(['tvSeries', 'seasonNumber'], { unique: true })
export class TvSeason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: SourceType })
  source: SourceType;

  @Column({ type: 'varchar', length: 255 })
  externalId: string;

  @ManyToOne(
    () => TvSeries,
    (series) => series.tvSeasons,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'tvSeriesId' })
  tvSeries: TvSeries;

  @RelationId((season: TvSeason) => season.tvSeries)
  tvSeriesId: number;

  @Column({ type: 'int' })
  seasonNumber: number;

  @Column({ type: 'int', nullable: true })
  episodeCount: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  posterPath: string | null;

  @Column({ type: 'date', nullable: true })
  airDate: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  overview: string | null;

  @Column({ type: 'float', nullable: true })
  voteAverage: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public updateFromDto(dto: TvSeasonDetailDto): void {
    this.airDate = dto.air_date ? new Date(dto.air_date) : null;
    this.episodeCount = dto.episode_count;
    this.name = dto.name;
    this.overview = dto.overview;
    this.posterPath = dto.poster_path;
    this.seasonNumber = dto.season_number;
    this.voteAverage = dto.vote_average;
  }

  public static createFromDto(dto: TvSeasonDetailDto): TvSeason {
    const season = new TvSeason();
    season.externalId = `${dto.id}`;
    season.source = SourceType.TMDB;
    season.updateFromDto(dto);
    return season;
  }
}
