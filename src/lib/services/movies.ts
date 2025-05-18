interface MovieDetails {
  id: string;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  genres: string[];
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character: string;
    }>;
  };
  cast?: Array<{
    id: number;
    name: string;
    character: string;
  }>;
}

interface SearchResult {
  page: number;
  results: MovieDetails[];
  totalPages: number;
  totalResults: number;
}

export interface SearchFilters {
  mediaTypes: string[];
  genres: string[];
  languages: string[];
  minRating?: number;
  includeAdult: boolean;
  cast?: string[];
  plot?: string;
  year?: string;
}

export class MovieService {
  private tmdbApiKey: string;
  private omdbApiKey: string;
  private tmdbBaseUrl = 'https://api.themoviedb.org/3';
  private omdbBaseUrl = 'https://www.omdbapi.com';

  constructor() {
    this.tmdbApiKey = process.env.TMDB_API_KEY || '';
    this.omdbApiKey = process.env.OMDB_API_KEY || '';

    if (!this.tmdbApiKey) {
      console.warn('TMDB API key not found');
    }
    if (!this.omdbApiKey) {
      console.warn('OMDB API key not found');
    }
  }

  private async fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const queryParams = new URLSearchParams({
      api_key: this.tmdbApiKey,
      ...params,
    });

    const response = await fetch(`${this.tmdbBaseUrl}${endpoint}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchOMDB<T>(params: Record<string, string>): Promise<T> {
    const queryParams = new URLSearchParams({
      apikey: this.omdbApiKey,
      ...params,
    });

    const response = await fetch(`${this.omdbBaseUrl}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`OMDB API error: ${response.statusText}`);
    }

    return response.json();
  }

  async searchMovie(filters: SearchFilters, page: number = 1): Promise<SearchResult> {
    try {
      // Parse year range if provided
      let yearStart: number | undefined;
      let yearEnd: number | undefined;
      
      if (filters.year) {
        const yearParts = filters.year.split('-');
        if (yearParts.length === 1) {
          // Single year
          yearStart = parseInt(yearParts[0]);
          yearEnd = yearStart;
        } else if (yearParts.length === 2) {
          // Year range
          yearStart = parseInt(yearParts[0]);
          yearEnd = parseInt(yearParts[1]);
        }
      }

      // First, get a list of movies that match the basic criteria
      const params: Record<string, string> = {
        page: page.toString(),
        language: 'en-US',
        include_adult: filters.includeAdult.toString(),
        vote_average_gte: filters.minRating?.toString() || '0',
        with_genres: filters.genres.join(','),
        with_original_language: filters.languages.join('|'),
        append_to_response: 'credits' // Include credits for cast filtering
      };

      // Add year filter if provided
      if (yearStart && !isNaN(yearStart)) {
        params.primary_release_date_gte = `${yearStart}-01-01`;
        
        if (yearEnd && !isNaN(yearEnd)) {
          params.primary_release_date_lte = `${yearEnd}-12-31`;
        } else {
          params.primary_release_date_lte = `${yearStart}-12-31`;
        }
      }

      // Add cast filter if provided
      if (filters.cast && filters.cast.length > 0) {
        params.with_cast = filters.cast.join('|');
      }

      // Add keyword search if plot is provided
      if (filters.plot) {
        params.with_keywords = filters.plot.replace(/\s+/g, '|');
      }

      console.log("TMDB API params:", params);
      const initialResults = await this.fetchTMDB<SearchResult>('/discover/movie', params);
      console.log(`Initial results: ${initialResults.results.length} movies`);

      // For each movie, fetch additional details including credits
      const detailedResults = await Promise.all(
        initialResults.results.map(async (movie) => {
          try {
            const details = await this.fetchTMDB<any>(`/movie/${movie.id}`, {
              append_to_response: 'credits'
            });
            return {
              ...movie,
              credits: details.credits
            };
          } catch (error) {
            console.error(`Error fetching details for movie ${movie.id}:`, error);
            return movie;
          }
        })
      );

      // Post-process results to ensure strict genre matching
      const strictResults = detailedResults.filter(movie => {
        // Check if movie has ALL requested genres
        const hasAllGenres = filters.genres.length === 0 || 
          filters.genres.every(genre => movie.genres.includes(genre));

        // Check if movie is of requested type
        const isRequestedType = filters.mediaTypes.some(type => {
          switch(type) {
            case 'movie': return true; // Since we're searching movies
            case 'webseries': return false; // Filter out if web series requested
            case 'indie': return movie.voteCount < 1000 && movie.genres.every(g => g !== 'Animation'); // Consider indie if less popular and not animation
            case 'animation': return movie.genres.includes('Animation');
            default: return false; // Don't include
          }
        });

        // Check if movie plot matches preference
        const matchesPlotPreference = !filters.plot || 
          movie.overview.toLowerCase().includes(filters.plot.toLowerCase());

        // Check if movie has requested cast members
        const hasCast = !filters.cast || filters.cast.length === 0 || 
          filters.cast.some(actor => {
            return movie.credits?.cast?.some(
              (castMember: { id: number; name: string; character: string }) => castMember.name.toLowerCase().includes(actor.toLowerCase())
            ) || false;
          });

        // Check if movie release year matches preference
        let matchesYear = true;
        if (yearStart && yearEnd) {
          const releaseYear = new Date(movie.releaseDate).getFullYear();
          matchesYear = releaseYear >= yearStart && releaseYear <= yearEnd;
        }

        const result = hasAllGenres && isRequestedType && matchesPlotPreference && hasCast && matchesYear;
        
        if (!result) {
          console.log(`Filtered out: ${movie.title} - Genres: ${hasAllGenres}, Type: ${isRequestedType}, Plot: ${matchesPlotPreference}, Cast: ${hasCast}, Year: ${matchesYear}`);
        }
        
        return result;
      });

      console.log(`Strict filtering results: ${strictResults.length} movies`);
      return {
        ...initialResults,
        results: strictResults,
        totalResults: strictResults.length
      };
    } catch (error) {
      console.error('Error searching movies:', error);
      throw error;
    }
  }

  async getMovieDetails(movieId: string): Promise<MovieDetails> {
    try {
      const tmdbDetails = await this.fetchTMDB<MovieDetails>(`/movie/${movieId}`, {
        append_to_response: 'videos,credits'
      });

      try {
        const omdbDetails = await this.fetchOMDB({
          i: movieId,
          plot: 'full'
        });

        return {
          ...tmdbDetails,
          // Add any additional OMDB fields you want to include
        };
      } catch (omdbError) {
        console.warn('OMDB enrichment failed:', omdbError);
        return tmdbDetails;
      }
    } catch (error) {
      console.error('Error fetching movie details:', error);
      throw error;
    }
  }

  async getRecommendations(movieId: string, page: number = 1): Promise<SearchResult> {
    try {
      return await this.fetchTMDB<SearchResult>(`/movie/${movieId}/recommendations`, {
        page: page.toString(),
        language: 'en-US',
      });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  }

  async discoverMovies(params: {
    genre?: string;
    year?: string;
    language?: string;
    minRating?: number;
    page?: number;
  }): Promise<SearchResult> {
    try {
      const queryParams: Record<string, string> = {
        language: 'en-US',
        sort_by: 'popularity.desc',
        page: (params.page || 1).toString(),
      };

      if (params.genre) queryParams.with_genres = params.genre;
      if (params.year) queryParams.year = params.year;
      if (params.language) queryParams.with_original_language = params.language;
      if (params.minRating) queryParams.vote_average_gte = params.minRating.toString();

      return await this.fetchTMDB<SearchResult>('/discover/movie', queryParams);
    } catch (error) {
      console.error('Error discovering movies:', error);
      throw error;
    }
  }
}
