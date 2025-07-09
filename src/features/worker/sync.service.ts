import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SourceType } from 'src/common/enums/source-type.enum';
import { DataSource, In, Repository } from 'typeorm';
import { ContentType } from '../../common/enums/content-type.enum';
import {
  MovieDetailDto,
  TvSeriesDetailDto,
} from '../../core/tmdb-api/dto/tmdb.dto';
import { TmdbApiService } from '../../core/tmdb-api/tmdb-api.service';
import { ContentGenre } from '../content/entities/content-genre.entity';
import { Genre } from '../content/entities/genre.entity';
import { Movie } from '../content/entities/movie.entity';
import { TvSeason } from '../content/entities/tv-season.entity';
import { TvSeries } from '../content/entities/tv-series.entity';

interface MovieDbData {
  existingMoviesMap: Map<string, Movie>;
  existingGenresMap: Map<string, Genre>;
}

interface TvSeriesDbData {
  existingSeriesMap: Map<string, TvSeries>;
  existingGenresMap: Map<string, Genre>;
  existingSeasonsMap: Map<string, TvSeason>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  // 💡 초기 벌크 로드 시 가져올 페이지 수를 상수로 정의
  private readonly INITIAL_BULK_LOAD_PAGES = 100;
  // DB 저장을 위한 Chunk 크기 (한 번에 저장할 엔티티 수)
  private readonly DB_SAVE_CHUNK_SIZE = 50;

  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(TvSeries)
    private readonly tvSeriesRepository: Repository<TvSeries>,
    @InjectRepository(TvSeason)
    private readonly tvSeasonRepository: Repository<TvSeason>,
    @InjectRepository(ContentGenre)
    private readonly contentGenreRepository: Repository<ContentGenre>,
    private readonly tmdbApiService: TmdbApiService,

    private readonly dataSource: DataSource,
  ) {}

  public async syncMoviesByIds(movieIds: number[]): Promise<void> {
    if (movieIds.length === 0) return;
    this.logger.log(`[Movie] Starting bulk sync for ${movieIds.length} items.`);

    const dtos = await this.getDetailsFromApi<MovieDetailDto>(
      ContentType.MOVIE,
      movieIds,
    );

    if (dtos.length === 0) {
      this.logger.warn('[Movie] No valid movie details found to sync.');
      return;
    }

    const dbData = await this.findMovieDataFromDb(dtos);
    const moviesToSave = this.buildMovieEntities(dtos, dbData);
    await this.saveMoviesInTransaction(moviesToSave);

    this.logger.log(
      `[Movie] Bulk sync completed for ${moviesToSave.length} items.`,
    );
  }

  public async syncTvSeriesByIds(tvSeriesIds: number[]): Promise<void> {
    if (tvSeriesIds.length === 0) return;
    this.logger.log(`[TV] Starting bulk sync for ${tvSeriesIds.length} items.`);

    const dtos = await this.getDetailsFromApi<TvSeriesDetailDto>(
      ContentType.TVSERIES,
      tvSeriesIds,
    );
    if (dtos.length === 0) {
      this.logger.warn('[TV] No valid TV series details found to sync.');
      return;
    }

    const dbData = await this.findTvSeriesDataFromDb(dtos);
    const seriesToSave = this.buildTvSeriesEntities(dtos, dbData);
    await this.saveTvSeriesInTransaction(seriesToSave);

    this.logger.log(
      `[TV] Bulk sync completed for ${seriesToSave.length} items.`,
    );
  }

  /**
   * 초기 데이터베이스 구성을 위해 모든 장르를 동기화합니다.
   */
  async syncAllGenres(): Promise<void> {
    this.logger.log('Syncing all genres...');
    const processGenres = async (
      genres: { id: number; name: string }[],
      type: ContentType,
    ) => {
      const existingGenres = await this.genreRepository.findBy({
        externalId: In(genres.map((g) => `${g.id}`)),
        source: SourceType.TMDB,
        type,
      });
      const genresByExternalId = new Map(
        existingGenres.map((g) => [g.externalId, g]),
      );

      const genresToSave = genres.map((dto) => {
        const genre =
          genresByExternalId.get(`${dto.id}`) ||
          this.genreRepository.create({
            externalId: `${dto.id}`,
            source: SourceType.TMDB,
            type,
          });
        genre.name = dto.name;
        return genre;
      });

      await this.genreRepository.save(genresToSave);
    };

    const [movieGenres, tvGenres] = await Promise.all([
      this.tmdbApiService.fetchGenres(ContentType.MOVIE),
      this.tmdbApiService.fetchGenres(ContentType.TVSERIES),
    ]);

    await Promise.all([
      processGenres(movieGenres, ContentType.MOVIE),
      processGenres(tvGenres, ContentType.TVSERIES),
    ]);
    this.logger.log('✅ Genre synchronization complete.');
  }

  /**
   * 초기 데이터 로드 또는 전체 재동기화를 실행합니다.
   */
  async initialBulkLoad(): Promise<void> {
    this.logger.log('🚀 Starting BULK synchronization...');
    await this.syncAllGenres();

    const fetchIdsFromPages = async (contentType: ContentType) => {
      const ids: number[] = [];
      for (let i = 1; i <= this.INITIAL_BULK_LOAD_PAGES; i++) {
        this.logger.log(
          `Fetching popular ${contentType} IDs from page ${i}/${this.INITIAL_BULK_LOAD_PAGES}...`,
        );
        const items = await this.tmdbApiService.fetchPopular<{ id: number }>(
          contentType,
          i,
        );
        if (items.length === 0) break;
        ids.push(...items.map((item) => item.id));
      }
      return ids;
    };

    const [movieIds, tvSeriesIds] = await Promise.all([
      fetchIdsFromPages(ContentType.MOVIE),
      fetchIdsFromPages(ContentType.TVSERIES),
    ]);

    this.logger.log(
      `Found ${movieIds.length} movies and ${tvSeriesIds.length} TV series to sync.`,
    );

    await Promise.all([
      this.syncMoviesByIds(movieIds),
      this.syncTvSeriesByIds(tvSeriesIds),
    ]);

    this.logger.log(`🎉 BULK synchronization complete.`);
  }

  /**
   * TMDB API에서 콘텐츠 상세 정보를 가져옵니다.
   */
  private async getDetailsFromApi<T>(
    type: ContentType,
    ids: number[],
  ): Promise<T[]> {
    const dtos = await Promise.all(
      ids.map((id) => this.tmdbApiService.fetchDetails<T>(type, id)),
    );

    const results: T[] = [];

    for (const dto of dtos) {
      if (dto !== null) {
        results.push(dto);
      }
    }

    return results;
  }

  /**
   * DB에서 영화 동기화에 필요한 기존 영화와 장르 데이터를 찾아옵니다.
   */
  private async findMovieDataFromDb(
    dtos: MovieDetailDto[],
  ): Promise<MovieDbData> {
    const movieTmdbIds: string[] = [];
    const genreTmdbIdSet = new Set<string>();

    for (const dto of dtos) {
      movieTmdbIds.push(`${dto.id}`);
      for (const genre of dto.genres) {
        genreTmdbIdSet.add(`${genre.id}`);
      }
    }

    const genreTmdbIds = [...genreTmdbIdSet];

    const [existingMovies, existingGenres] = await Promise.all([
      this.movieRepository.findBy({
        externalId: In(movieTmdbIds),
        source: SourceType.TMDB,
      }),
      this.genreRepository.findBy({
        externalId: In(genreTmdbIds),
        source: SourceType.TMDB,
        type: ContentType.MOVIE,
      }),
    ]);

    return {
      existingMoviesMap: new Map(existingMovies.map((m) => [m.externalId, m])),
      existingGenresMap: new Map(existingGenres.map((g) => [g.externalId, g])),
    };
  }

  /**
   * DB에서 TV 동기화에 필요한 기존 시리즈, 장르, 시즌 데이터를 찾아옵니다.
   */
  private async findTvSeriesDataFromDb(
    dtos: TvSeriesDetailDto[],
  ): Promise<TvSeriesDbData> {
    const seriesTmdbIds: string[] = [];
    const genreTmdbIdSet = new Set<string>();
    const seasonTmdbIdSet = new Set<string>();

    for (const dto of dtos) {
      seriesTmdbIds.push(`${dto.id}`);
      for (const genre of dto.genres) {
        genreTmdbIdSet.add(`${genre.id}`);
      }
      if (dto.seasons) {
        for (const season of dto.seasons) {
          seasonTmdbIdSet.add(`${season.id}`);
        }
      }
    }

    const genreTmdbIds = [...genreTmdbIdSet];
    const seasonTmdbIds = [...seasonTmdbIdSet];

    const [existingSeries, existingGenres, existingSeasons] = await Promise.all(
      [
        this.tvSeriesRepository.findBy({
          externalId: In(seriesTmdbIds),
          source: SourceType.TMDB,
        }),
        this.genreRepository.findBy({
          externalId: In(genreTmdbIds),
          source: SourceType.TMDB,
          type: ContentType.TVSERIES,
        }),
        this.tvSeasonRepository.findBy({
          externalId: In(seasonTmdbIds),
          source: SourceType.TMDB,
        }),
      ],
    );

    return {
      existingSeriesMap: new Map(existingSeries.map((s) => [s.externalId, s])),
      existingGenresMap: new Map(existingGenres.map((g) => [g.externalId, g])),
      existingSeasonsMap: new Map(
        existingSeasons.map((s) => [s.externalId, s]),
      ),
    };
  }

  /**
   * API 데이터와 DB 데이터를 조합하여 저장할 영화 엔티티 목록을 만듭니다.
   */
  private buildMovieEntities(
    dtos: MovieDetailDto[],
    dbData: MovieDbData,
  ): Movie[] {
    const { existingMoviesMap, existingGenresMap } = dbData;
    const moviesToSave: Movie[] = [];

    for (const dto of dtos) {
      const movie =
        existingMoviesMap.get(`${dto.id}`) || Movie.createFromDto(dto);
      if (existingMoviesMap.has(`${dto.id}`)) {
        movie.updateFromDto(dto);
      }

      const genresForMovie: Genre[] = [];
      for (const genreDto of dto.genres) {
        const genreEntity = existingGenresMap.get(`${genreDto.id}`);
        if (genreEntity) {
          genresForMovie.push(genreEntity);
        }
      }
      movie.setGenres(genresForMovie);

      moviesToSave.push(movie);
    }
    return moviesToSave;
  }

  /**
   * API 데이터와 DB 데이터를 조합하여 저장할 TV 시리즈와 시즌 엔티티 목록을 만듭니다.
   */
  private buildTvSeriesEntities(
    dtos: TvSeriesDetailDto[],
    dbData: TvSeriesDbData,
  ): TvSeries[] {
    const { existingSeriesMap, existingGenresMap, existingSeasonsMap } = dbData;
    const seriesToSave: TvSeries[] = [];

    for (const dto of dtos) {
      const series =
        existingSeriesMap.get(`${dto.id}`) || TvSeries.createFromDto(dto);
      if (existingSeriesMap.has(`${dto.id}`)) {
        series.updateFromDto(dto);
      }

      const genresForSeries: Genre[] = [];
      for (const genreDto of dto.genres) {
        const genreEntity = existingGenresMap.get(`${genreDto.id}`);
        if (genreEntity) {
          genresForSeries.push(genreEntity);
        }
      }
      series.setGenres(genresForSeries);

      const seasonsForSeries: TvSeason[] = [];
      if (dto.seasons) {
        for (const seasonDto of dto.seasons) {
          const season =
            existingSeasonsMap.get(`${seasonDto.id}`) ||
            TvSeason.createFromDto(seasonDto);
          if (existingSeasonsMap.has(`${seasonDto.id}`)) {
            season.updateFromDto(seasonDto);
          }
          season.tvSeries = series;
          seasonsForSeries.push(season);
        }
      }
      series.setSeasons(seasonsForSeries);

      seriesToSave.push(series);
    }
    return seriesToSave;
  }

  /**
   * 영화 엔티티와 관련 관계들을 저장합니다.
   */
  private async saveMoviesInTransaction(moviesToSave: Movie[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.save(moviesToSave, { chunk: this.DB_SAVE_CHUNK_SIZE });

      const allContentGenres: ContentGenre[] = [];
      for (const movie of moviesToSave) {
        if (movie.contentGenres) {
          for (const contentGenre of movie.contentGenres) {
            contentGenre.content = movie;
            allContentGenres.push(contentGenre);
          }
        }
      }

      if (allContentGenres.length > 0) {
        await manager.save(ContentGenre, allContentGenres, {
          chunk: this.DB_SAVE_CHUNK_SIZE,
        });
      }
    });
  }

  /**
   * TV 시리즈와 관련 관계들을 저장합니다.
   */
  private async saveTvSeriesInTransaction(
    seriesToSave: TvSeries[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.save(seriesToSave, { chunk: this.DB_SAVE_CHUNK_SIZE });

      const allContentGenres: ContentGenre[] = [];
      for (const series of seriesToSave) {
        if (series.contentGenres) {
          for (const contentGenre of series.contentGenres) {
            contentGenre.content = series;
            allContentGenres.push(contentGenre);
          }
        }
      }

      if (allContentGenres.length > 0) {
        await manager.save(ContentGenre, allContentGenres, {
          chunk: this.DB_SAVE_CHUNK_SIZE,
        });
      }
    });
  }
}
