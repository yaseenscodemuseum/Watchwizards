interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  vote_average: number;
  genre_ids: number[];
  adult: boolean;
}

interface OMDBMovie {
  Title: string;
  Year: string;
  imdbRating: string;
  Plot: string;
  Rated: string;
}

export class MovieService {
  private tmdbKey: string;
  private omdbKey: string;

  constructor() {
    this.tmdbKey = process.env.TMDB_API_KEY || '';
    this.omdbKey = process.env.OMDB_API_KEY || '';
  }

  async searchMovie(title: string): Promise<{
    title: string;
    year: string;
    overview: string;
    imdbRating: number;
    isMatureContent: boolean;
  } | null> {
    try {
      // Try TMDB first
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${this.tmdbKey}&query=${encodeURIComponent(title)}`
      );
      const tmdbData = await tmdbResponse.json();
      const tmdbMovie = tmdbData.results?.[0] as TMDBMovie | undefined;

      if (!tmdbMovie) return null;

      // If TMDB rating is below 7, double-check with OMDB for potentially better data
      if (tmdbMovie.vote_average < 7) {
        try {
          const omdbResponse = await fetch(
            `http://www.omdbapi.com/?apikey=${this.omdbKey}&t=${encodeURIComponent(title)}`
          );
          const omdbMovie = await omdbResponse.json() as OMDBMovie;
          
          if (omdbMovie.imdbRating) {
            return {
              title: tmdbMovie.title,
              year: tmdbMovie.release_date.split('-')[0],
              overview: tmdbMovie.overview,
              imdbRating: parseFloat(omdbMovie.imdbRating),
              isMatureContent: tmdbMovie.adult || omdbMovie.Rated === 'R' || omdbMovie.Rated === 'NC-17'
            };
          }
        } catch (error) {
          console.error('OMDB fallback failed, using TMDB data only');
        }
      }

      // Use TMDB data only
      return {
        title: tmdbMovie.title,
        year: tmdbMovie.release_date.split('-')[0],
        overview: tmdbMovie.overview,
        imdbRating: tmdbMovie.vote_average,
        isMatureContent: tmdbMovie.adult
      };
    } catch (error) {
      console.error('Error fetching movie data:', error);
      return null;
    }
  }

  async validateRecommendations(recommendations: any[], preferences: any) {
    const validatedRecs = [];
    const processedTitles = new Set(); // Avoid duplicate recommendations

    for (const rec of recommendations) {
      // Skip if we've already processed this title
      if (processedTitles.has(rec.title.toLowerCase())) continue;

      const movieData = await this.searchMovie(rec.title);
      
      if (movieData) {
        processedTitles.add(rec.title.toLowerCase());
        
        // Check if movie meets user's criteria
        const meetsRating = !preferences.minImdbRating || movieData.imdbRating >= preferences.minImdbRating;
        const meetsMatureContent = preferences.allowMature || !movieData.isMatureContent;

        if (meetsRating && meetsMatureContent) {
          validatedRecs.push({
            ...rec,
            year: movieData.year,
            overview: movieData.overview,
            imdbRating: movieData.imdbRating
          });
        }
      }

      // Stop if we have enough valid recommendations
      if (validatedRecs.length >= 5) break;
    }

    return validatedRecs;
  }
} 