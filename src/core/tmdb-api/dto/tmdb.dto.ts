// 번역 데이터의 상세 구조를 정의
export interface TranslationDataDto {
  title?: string;
  name?: string;
  overview: string;
}

// 개별 번역 객체의 구조를 정의
export interface TranslationDto {
  iso_3166_1: string;
  iso_639_1: string;
  name: string;
  english_name: string;
  data: TranslationDataDto;
}

// 최상위 translations 객체의 구조를 정의
export interface TranslationsDto {
  translations: TranslationDto[];
}

// 공통으로 사용되는 장르 타입
export interface GenreDto {
  id: number;
  name: string;
}

// '인기 목록' 등 목록 API에서 오는 기본 정보
export interface BaseContentListItemDto {
  id: number;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
  genre_ids: number[];
}

// 영화 목록 아이템 DTO
export interface MovieListItemDto extends BaseContentListItemDto {
  title: string;
  original_title: string;
  release_date: string;
  adult: boolean;
}

// TV 시리즈 목록 아이템 DTO
export interface TvSeriesListItemDto extends BaseContentListItemDto {
  name: string;
  original_name: string;
  first_air_date: string;
}

// '상세 정보' API에서 오는 공통 정보
interface BaseContentDetailDto extends BaseContentListItemDto {
  genres: GenreDto[];
  status: string;
}

// 영화 상세 정보 DTO
export interface MovieDetailDto extends BaseContentDetailDto {
  title: string;
  original_title: string;
  release_date: string;
  adult: boolean;
  runtime: number | null;
  video: boolean;
  translations?: TranslationsDto;
}

// TV 시즌 상세 정보 DTO
export interface TvSeasonDetailDto {
  id: number;
  air_date: string | null;
  episode_count: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

// TV 시리즈 상세 정보 DTO
export interface TvSeriesDetailDto extends BaseContentDetailDto {
  name: string;
  original_name: string;
  first_air_date: string;
  last_air_date: string | null;
  number_of_episodes: number;
  number_of_seasons: number;
  seasons: TvSeasonDetailDto[];
  translations?: TranslationsDto;
}
