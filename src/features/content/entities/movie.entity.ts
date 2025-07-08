import { ContentType } from 'src/common/enums/content-type.enum';
import { MovieStatus } from 'src/common/enums/movie-status.enum';
import { SourceType } from 'src/common/enums/source-type.enum';
import { isValueInEnum } from 'src/common/enums/utils/is-value-in-enum';
import { MovieDetailDto } from 'src/core/tmdb-api/dto/tmdb.dto';
import { ChildEntity, Column } from 'typeorm';
import { Content } from './content.entity';

@ChildEntity()
export class Movie extends Content {
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
  englishTitle: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  originalTitle: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  originalLanguage: string | null;

  @Column({ type: 'date', nullable: true })
  releaseDate: Date | null;

  @Column({ type: 'boolean', default: false })
  adult: boolean;

  @Column({ type: 'int', nullable: true })
  runtime: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: MovieStatus | null;

  public updateFromDto(dto: MovieDetailDto): void {
    this.title = dto.title;
    this.overview = dto.overview;
    this.posterPath = dto.poster_path;
    this.backdropPath = dto.backdrop_path;
    this.voteAverage = dto.vote_average;
    this.voteCount = dto.vote_count;
    this.popularity = dto.popularity;
    this.originalTitle = dto.original_title;
    this.originalLanguage = dto.original_language;
    this.releaseDate = dto.release_date ? new Date(dto.release_date) : null;
    this.adult = dto.adult;
    this.runtime = dto.runtime;

    if (dto.translations?.translations) {
      const translations = dto.translations.translations;

      const englishTranslation = translations.find((t) => t.iso_639_1 === 'en');
      this.englishTitle = englishTranslation?.data?.title ?? null;

      const koreanTranslation = translations.find((t) => t.iso_639_1 === 'ko');
      this.hasKoreanTitle = !!koreanTranslation?.data?.title;
    } else {
      this.hasKoreanTitle = false;
    }

    if (isValueInEnum(MovieStatus, dto.status)) {
      this.status = dto.status;
    } else {
      this.status = null;
    }
  }

  public static createFromDto(dto: MovieDetailDto): Movie {
    const movie = new Movie();
    movie.externalId = `${dto.id}`;
    movie.source = SourceType.TMDB;
    movie.type = ContentType.MOVIE;
    movie.updateFromDto(dto);
    return movie;
  }

  get displayTitle(): string {
    if (this.hasKoreanTitle) {
      return this.title;
    }

    return this.englishTitle || this.originalTitle || this.title;
  }
}
