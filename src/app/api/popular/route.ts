import { NextResponse } from 'next/server';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Refresh the popular lists at most once an hour
export const revalidate = 3600;

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  poster_path: string | null;
  genre_ids: number[];
  original_language: string;
}

export interface PopularItem {
  id: string;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  genres: string[];
  voteAverage: number;
  director: string;
  tmdbUrl: string;
  imdbUrl: string | null;
  mediaType: 'movie' | 'tv';
}

async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ api_key: process.env.TMDB_API_KEY || '', ...params });
  const response = await fetch(`${TMDB_BASE_URL}${endpoint}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function toPopularItem(result: TMDBResult, mediaType: 'movie' | 'tv', genreMap: Map<number, string>): Promise<PopularItem> {
  let director = '';
  let imdbId: string | null = null;
  try {
    const details = await fetchTMDB(`/${mediaType}/${result.id}`, {
      append_to_response: 'credits,external_ids'
    });
    director = mediaType === 'movie'
      ? details.credits?.crew?.find((c: { job?: string }) => c.job === 'Director')?.name || ''
      : details.created_by?.[0]?.name || '';
    imdbId = details.imdb_id || details.external_ids?.imdb_id || null;
  } catch (error) {
    console.error(`Failed to fetch details for ${mediaType} ${result.id}:`, error);
  }

  return {
    id: `${mediaType}-${result.id}`,
    title: result.title || result.name || '',
    overview: result.overview,
    posterPath: result.poster_path ? `${TMDB_IMAGE_BASE_URL}${result.poster_path}` : null,
    releaseDate: result.release_date || result.first_air_date || null,
    genres: result.genre_ids.map(id => genreMap.get(id)).filter((g): g is string => !!g),
    voteAverage: result.vote_average,
    director,
    tmdbUrl: `https://www.themoviedb.org/${mediaType}/${result.id}`,
    imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
    mediaType
  };
}

export async function GET() {
  try {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const gte = threeMonthsAgo.toISOString().split('T')[0];
    const lte = today.toISOString().split('T')[0];

    const [movieDiscover, tvDiscover, movieGenres, tvGenres] = await Promise.all([
      fetchTMDB('/discover/movie', {
        sort_by: 'popularity.desc',
        include_adult: 'false',
        'primary_release_date.gte': gte,
        'primary_release_date.lte': lte,
        'vote_count.gte': '20'
      }),
      fetchTMDB('/discover/tv', {
        sort_by: 'popularity.desc',
        include_adult: 'false',
        'first_air_date.gte': gte,
        'first_air_date.lte': lte,
        'vote_count.gte': '10'
      }),
      fetchTMDB('/genre/movie/list'),
      fetchTMDB('/genre/tv/list')
    ]);

    const movieGenreMap = new Map<number, string>(
      (movieGenres.genres || []).map((g: { id: number; name: string }) => [g.id, g.name])
    );
    const tvGenreMap = new Map<number, string>(
      (tvGenres.genres || []).map((g: { id: number; name: string }) => [g.id, g.name])
    );

    const topMovies: TMDBResult[] = (movieDiscover.results || []).slice(0, 5);
    const topShows: TMDBResult[] = (tvDiscover.results || []).slice(0, 5);

    const [movies, shows] = await Promise.all([
      Promise.all(topMovies.map(m => toPopularItem(m, 'movie', movieGenreMap))),
      Promise.all(topShows.map(s => toPopularItem(s, 'tv', tvGenreMap)))
    ]);

    return NextResponse.json({ movies, shows });
  } catch (error) {
    console.error('Error fetching popular titles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular titles' },
      { status: 500 }
    );
  }
}
