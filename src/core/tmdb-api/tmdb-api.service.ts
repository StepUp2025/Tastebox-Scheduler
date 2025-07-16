// src/tmdb-api/tmdb-api.service.ts

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig } from 'axios';
import Bottleneck from 'bottleneck';
import { firstValueFrom } from 'rxjs';
import { ContentType } from 'src/common/enums/content-type.enum';

@Injectable()
export class TmdbApiService {
  private readonly logger = new Logger(TmdbApiService.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly limiter = new Bottleneck({
    maxConcurrent: 5, // 동시에 최대 5개
    minTime: 250, // 각 요청 사이 최소 250ms (10초에 40건)
    // TMDB의 10초 40회 제한을 더 잘 맞추기 위한 reservoir 설정 추가 (burst 허용)
    reservoir: 40,
    reservoirRefreshAmount: 40,
    reservoirRefreshInterval: 10 * 1000, // 10초마다
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiUrl = this.configService.get<string>('TMDB_API_URL');
    const apiToken = this.configService.get<string>('TMDB_ACCESS_TOKEN');

    if (!apiUrl || !apiToken) {
      throw new Error(
        'TMDB API URL 또는 Access Token이 .env 파일에 설정되지 않았습니다.',
      );
    }

    this.baseUrl = apiUrl;
    this.accessToken = apiToken;
  }

  async throttledGet<T>(
    path: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T | null> {
    return this.limiter.schedule(() => this.get<T>(path, params));
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T | null> {
    const config: AxiosRequestConfig = {
      params: { language: 'ko-KR', ...params },
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        accept: 'application/json',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(`${this.baseUrl}${path}`, config),
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        this.logger.warn(`Resource not found at ${path}, skipping.`);
        return null;
      }

      this.logger.error(`Failed to fetch from ${path}: ${error.message}`);
      throw error;
    }
  }

  // 공통 장르
  async fetchGenres(
    type: ContentType,
  ): Promise<{ id: number; name: string }[]> {
    const data = await this.throttledGet<{
      genres: { id: number; name: string }[];
    }>(`/genre/${type}/list`);
    return data ? data.genres : [];
  }

  // 인기 목록
  async fetchPopular<T>(
    type: ContentType,
    page: number,
    withoutKeywordIds?: Set<number>,
  ): Promise<T[]> {
    const path = `/discover/${type}`;

    const discoverParams: Record<string, string | number | boolean> = {
      page,
      sort_by: 'popularity.desc',
      include_adult: false,
    };

    if (type === ContentType.MOVIE) {
      discoverParams.include_video = false;
    }

    if (withoutKeywordIds && withoutKeywordIds.size > 0) {
      discoverParams.without_keywords = Array.from(withoutKeywordIds).join(',');
    }

    const data = await this.throttledGet<{ results: T[] }>(
      path,
      discoverParams,
    );
    return data ? data.results : [];
  }

  async fetchDetails<T>(type: ContentType, id: number): Promise<T | null> {
    const detailParams: Record<string, string | number | boolean> = {
      append_to_response: 'translations,keywords',
      language: 'ko-KR',
    };
    return this.throttledGet<T>(`/${type}/${id}`, detailParams);
  }

  async fetchChangedIds(
    type: ContentType,
    startDate: string,
    endDate: string,
  ): Promise<number[]> {
    let allIds: number[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const data = await this.throttledGet<{
        results: { id: number }[];
        total_pages: number;
      }>(`/${type}/changes`, {
        start_date: startDate,
        end_date: endDate,
        page,
      });

      if (!data) {
        break;
      }

      allIds = allIds.concat(data.results.map((item) => item.id));
      totalPages = data.total_pages;
      page++;
    }
    return [...new Set(allIds)];
  }
}
