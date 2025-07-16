// common/utils/tmdb-filter.util.ts
export function parseTmdbExcludedKeywords(keywords: string): Set<number> {
  return new Set(
    keywords
      .split(',')
      .map((id) => Number(id.trim()))
      .filter(Number.isInteger),
  );
}
