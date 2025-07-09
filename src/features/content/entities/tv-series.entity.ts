import { ContentType } from 'src/common/enums/content-type.enum';
import { SourceType } from 'src/common/enums/source-type.enum';
import { TvSeriesStatus } from 'src/common/enums/tv-series-status.enum';
import { isValueInEnum } from 'src/common/enums/utils/is-value-in-enum';
import { TvSeriesDetailDto } from 'src/core/tmdb-api/dto/tmdb.dto';
import { ChildEntity, Column, OneToMany } from 'typeorm';
import { Content } from './content.entity';
import { TvSeason } from './tv-season.entity';

@ChildEntity()
export class TvSeries extends Content {
  @Column({ type: 'text', nullable: true })
  overview: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  posterPath: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  backdropPath: string | null;

  @Column({ type: 'float', nullable: true })
  voteAverage: number | null;

  @Column({ type: 'int', nullable: true })
  voteCount: number | null;

  @Column({ type: 'float', nullable: true })
  popularity: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  originalTitle: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  originalLanguage: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  englishTitle: string | null;

  @Column({ type: 'date', nullable: true })
  firstAirDate: Date | null;

  @Column({ type: 'date', nullable: true })
  lastAirDate: Date | null;

  @Column({ type: 'int', nullable: true })
  numberOfEpisodes: number | null;

  @Column({ type: 'int', nullable: true })
  numberOfSeasons: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  originalName: string | null;

  @OneToMany(
    () => TvSeason,
    (season) => season.tvSeries,
    { cascade: true },
  )
  tvSeasons: TvSeason[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: TvSeriesStatus | null;

  public updateFromDto(dto: TvSeriesDetailDto): void {
    this.title = dto.name;
    this.overview = dto.overview;
    this.posterPath = dto.poster_path;
    this.backdropPath = dto.backdrop_path;
    this.voteAverage = dto.vote_average;
    this.voteCount = dto.vote_count;
    this.popularity = dto.popularity;
    this.originalTitle = dto.original_name;
    this.originalLanguage = dto.original_language;
    this.firstAirDate = dto.first_air_date
      ? new Date(dto.first_air_date)
      : null;
    this.lastAirDate = dto.last_air_date ? new Date(dto.last_air_date) : null;
    this.numberOfEpisodes = dto.number_of_episodes;
    this.numberOfSeasons = dto.number_of_seasons;

    if (dto.translations?.translations) {
      const translations = dto.translations.translations;

      const englishTranslation = translations.find((t) => t.iso_639_1 === 'en');
      this.englishTitle = englishTranslation?.data?.title ?? null;

      const koreanTranslation = translations.find((t) => t.iso_639_1 === 'ko');
      this.hasKoreanTitle = !!koreanTranslation?.data?.title;
    } else {
      this.hasKoreanTitle = false;
    }

    if (isValueInEnum(TvSeriesStatus, dto.status)) {
      this.status = dto.status;
    } else {
      this.status = null;
    }
  }

  public static createFromDto(dto: TvSeriesDetailDto): TvSeries {
    const series = new TvSeries();
    series.externalId = `${dto.id}`;
    series.source = SourceType.TMDB;
    series.type = ContentType.TVSERIES;
    series.updateFromDto(dto);
    return series;
  }

  public setSeasons(seasons: TvSeason[]): void {
    this.tvSeasons = seasons;
    for (const season of seasons) {
      season.tvSeries = this;
    }
  }

  get displayTitle(): string {
    if (this.hasKoreanTitle) {
      return this.title;
    }

    return this.englishTitle || this.originalTitle || this.title;
  }
}
