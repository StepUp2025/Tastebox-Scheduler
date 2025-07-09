import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ContentType } from 'src/common/enums/content-type.enum';
import { Repository } from 'typeorm';
import { TmdbApiService } from '../../core/tmdb-api/tmdb-api.service';
import { Content } from '../content/entities/content.entity';
import { SyncStatus } from '../content/entities/sync-status.entity';
import { SyncService } from './sync.service';

const LAST_METADATA_SYNC_DATE_KEY = 'lastMetadataSyncDate';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);
  private isSyncingMetadata = false;
  private isSyncingPopularity = false;
  private lastMetadataSyncDate: Date;
  private readonly POPULARITY_SYNC_PAGES = 200;

  constructor(
    private readonly syncService: SyncService,
    private readonly tmdbApiService: TmdbApiService,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
    @InjectRepository(SyncStatus)
    private readonly syncStatusRepository: Repository<SyncStatus>,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 TasksService initialized. Starting initial check...');

    // DB에서 마지막 동기화 날짜 로드
    const syncStatus = await this.syncStatusRepository.findOneBy({
      key: LAST_METADATA_SYNC_DATE_KEY,
    });

    if (syncStatus) {
      this.lastMetadataSyncDate = new Date(syncStatus.value);
    } else {
      // DB에 값이 없으면(최초 실행), 1일 전으로 설정
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      this.lastMetadataSyncDate = yesterday;
    }

    this.logger.log(
      `Last metadata sync date loaded as: ${this.lastMetadataSyncDate.toISOString()}`,
    );

    const contentCount = await this.contentRepository.count();

    if (contentCount === 0) {
      this.logger.log(
        'Content database is empty. Starting initial bulk load immediately.',
      );
      await this.runBulkLoad();
      await this.handleIncrementalSync();
    } else {
      this.logger.log(
        'Database contains data. Running an initial incremental sync and popularity update.',
      );
      await this.handleIncrementalSync();
      await this.handlePeriodicPopularityAndRatingSync();
    }
    this.logger.log('✅ Initial sync sequences finished.');
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'incrementalMetadataSync' })
  async handleIncrementalSync() {
    if (this.isSyncingMetadata) {
      this.logger.warn(
        'Previous metadata sync is still in progress. Skipping.',
      );
      return;
    }

    this.isSyncingMetadata = true;
    const startTime = performance.now();
    this.logger.log('⚙️ Starting incremental metadata sync...');

    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - 1);

      if (this.lastMetadataSyncDate.getTime() >= endDate.getTime()) {
        this.logger.log(
          'Metadata is already up-to-date. No changes sync needed.',
        );
        this.isSyncingMetadata = false;
        return;
      }

      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      const startDateStr = formatDate(this.lastMetadataSyncDate);
      const endDateStr = formatDate(endDate);

      this.logger.log(
        `Checking for metadata changes from ${startDateStr} to ${endDateStr}`,
      );

      // 변경된 ID들을 한 번에 가져와서 벌크로 처리
      const [changedMovieIds, changedTvSeriesIds] = await Promise.all([
        this.tmdbApiService.fetchChangedIds(
          ContentType.MOVIE,
          startDateStr,
          endDateStr,
        ),
        this.tmdbApiService.fetchChangedIds(
          ContentType.TVSERIES,
          startDateStr,
          endDateStr,
        ),
      ]);

      await Promise.all([
        this.syncService.syncMoviesByIds(changedMovieIds),
        this.syncService.syncTvSeriesByIds(changedTvSeriesIds),
      ]);

      // 동기화 완료 후 마지막 동기화 날짜 DB에 업데이트
      this.lastMetadataSyncDate = today;
      await this.syncStatusRepository.upsert(
        {
          key: LAST_METADATA_SYNC_DATE_KEY,
          value: this.lastMetadataSyncDate.toISOString(),
        },
        ['key'],
      );
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      const totalProcessed = changedMovieIds.length + changedTvSeriesIds.length;
      this.logger.log(
        `✅ Incremental metadata sync finished in ${duration}s. Total ${totalProcessed} items processed.`,
      );
    } catch (error) {
      this.logger.error('Incremental metadata sync failed', error.stack);
    } finally {
      this.isSyncingMetadata = false;
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS, {
    name: 'periodicPopularityAndRatingSync',
  })
  async handlePeriodicPopularityAndRatingSync() {
    if (this.isSyncingPopularity) {
      this.logger.warn(
        'Previous popularity/rating sync is still in progress. Skipping.',
      );
      return;
    }

    this.isSyncingPopularity = true;
    const startTime = performance.now();
    this.logger.log('⚙️ Starting periodic popularity and rating sync...');

    try {
      // 모든 페이지에서 ID를 수집한 후 한 번에 벌크 처리
      const fetchAllPopularIds = async (
        contentType: ContentType,
      ): Promise<number[]> => {
        const allIds: number[] = [];
        for (let page = 1; page <= this.POPULARITY_SYNC_PAGES; page++) {
          const items = await this.tmdbApiService.fetchPopular<{ id: number }>(
            contentType,
            page,
          );
          if (items.length === 0) break;
          allIds.push(...items.map((item) => item.id));
        }
        return allIds;
      };

      const [popularMovieIds, popularTvSeriesIds] = await Promise.all([
        fetchAllPopularIds(ContentType.MOVIE),
        fetchAllPopularIds(ContentType.TVSERIES),
      ]);

      this.logger.log(
        `Syncing popularity for ${popularMovieIds.length} movies and ${popularTvSeriesIds.length} TV series.`,
      );

      await Promise.all([
        this.syncService.syncMoviesByIds(popularMovieIds),
        this.syncService.syncTvSeriesByIds(popularTvSeriesIds),
      ]);

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      this.logger.log(
        `✅ Periodic popularity and rating sync finished in ${duration}s.`,
      );
    } catch (error) {
      this.logger.error(
        'Periodic popularity and rating sync failed',
        error.stack,
      );
    } finally {
      this.isSyncingPopularity = false;
    }
  }

  async runBulkLoad() {
    if (this.isSyncingMetadata || this.isSyncingPopularity) {
      this.logger.warn(
        'Another sync process is already running. Skipping bulk load.',
      );
      return;
    }
    this.isSyncingMetadata = true;
    const startTime = performance.now();
    this.logger.log('⚙️ Starting manual bulk load...');
    try {
      await this.syncService.initialBulkLoad();
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✅ Manual bulk load finished in ${duration}s.`);
    } catch (error) {
      this.logger.error('Manual bulk load failed', error.stack);
    } finally {
      this.isSyncingMetadata = false;
    }
  }
}
