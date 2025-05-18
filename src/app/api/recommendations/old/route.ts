import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import axios from 'axios';
import { AIService, MoviePreference } from '@/lib/services/AIService';

// Interfaces
interface TMDBGenre {
  id: number;
  name: string;
}

interface TMDBCredit {
  id: number;
  name: string;
  job?: string;
}

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  original_language: string;
  media_type?: string;
  relevancePosition?: number;
}

interface TMDBResponse {
  results?: TMDBSearchResult[];
  genres?: { id: number; name: string; }[];
}

interface RecommendationRequest {
  contentType: string[];
  languages: string[];
  genres: string[];
  plot?: string;
  similarMovies?: string;
  preferredYear?: string;
  cast?: string;
  rating?: string;
  mature?: boolean;
}

interface MovieDetails {
  id: string;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  genres: string[];
  originalLanguage: string;
  voteAverage: number;
  cast: string[];
  director: string;
  imdbId: string | null;
  tmdbId: string;
  tmdbUrl: string;
  imdbUrl: string | null;
  relevancePosition: number;
  mediaType: string;
  type: 'movie' | 'webseries';
  language: string;
}

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  original_language: string;
  original_title?: string;
  original_name?: string;
}

interface MovieMatch {
  result: TMDBResult;
  similarity: number;
  yearDiff: number;
  yearMatch: boolean;
  resultTitle: string;
  resultYear: number;
  languageMatch: boolean;
}

interface TMDBSearchParams extends Record<string, string | undefined> {
  query: string;
  year?: string;
  language: string;
  include_adult: string;
}

interface MovieRecommendation {
  title: string;
  year: string;
  description: string;
  genres: string[];
  language: string;
}

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const huggingface = axios.create({
  baseURL: 'https://api-inference.huggingface.co/models',
  headers: {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
  }
});

// TMDB API configuration
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// OMDB API configuration
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const OMDB_BASE_URL = 'http://www.omdbapi.com/';

// Add language detection utilities
const languageDetectors = {
  de: (text: string) => /[\u00C4\u00E4\u00D6\u00F6\u00DC\u00FC\u00DF]/.test(text), // German
  en: (text: string) => /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text), // English
  es: (text: string) => /[áéíóúüñ¿¡]/i.test(text), // Spanish
  fr: (text: string) => /[àâäéèêëîïôöùûüÿçœæ]/i.test(text), // French
  hi: (text: string) => /[\u0900-\u097F]/.test(text), // Hindi
  ja: (text: string) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text), // Japanese
  ko: (text: string) => /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text), // Korean
  ur: (text: string) => /[\u0600-\u06FF]/.test(text), // Urdu
};

const languageCodes: Record<string, string> = {
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  hi: 'hi',
  ja: 'ja',
  ko: 'ko',
  ur: 'ur'
};

type LanguageCode = 'de' | 'en' | 'es' | 'fr' | 'hi' | 'ja' | 'ko' | 'ur';

// Update regex patterns to be more forgiving
const regexPatterns: Record<LanguageCode, RegExp[]> = {
  en: [
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ],
  ko: [
    /\*\*\s*([^(\\n]+)\s*\((\d{4})\)\s*-\\s*([^|]+?)\\s*\|\\s*Genres:\\s*([^\\n]+)/gm
  ],
  ja: [
    /\*\s*([^(]+?)\s*\(([^)]+?)\)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm,
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ],
  hi: [
    /\*\s*([^(]+?)\s*\(([^)]+?)\)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm,
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ],
  fr: [
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ],
  de: [
    /\*\s*([^(]+?)\s*\(([^)]+?)\)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm,
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ],
  es: [
    /\*\s*([^(]+?)\s*\(([^)]+?)\)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm,
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ],
  ur: [
    /\*\s*([^(]+?)\s*\(([^)]+?)\)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm,
    /\*\s*([^\n]+?)\s*\((\d{4})\)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm
  ]
};

// Add a fallback pattern for any format that might have been missed
const fallbackPattern = /\*\s*([^\n]+?)\s*-\s*([^|]+?)\s*\|\s*Genres:\s*([^\n]+)/gm;

// Helper function for TMDB API calls with retries
async function fetchFromTMDB(endpoint: string, params: Record<string, string | undefined> = {}): Promise<any> {
  const apiKey = process.env.TMDB_API_KEY;
  const baseUrl = 'https://api.themoviedb.org/3';
  const retries = 3;
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('api_key', apiKey || '');
      
      // Only append defined params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value);
        }
      });

      const url = `${baseUrl}${endpoint}?${queryParams.toString()}`;
      console.log('TMDB API Request:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      console.log('TMDB API Response:', text.substring(0, 200) + '...');
      
      try {
        return JSON.parse(text);
      } catch (parseError: any) {
        console.error('Failed to parse TMDB response:', text);
        throw new Error(`Invalid JSON response from TMDB API: ${parseError?.message || 'Unknown error'}`);
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`TMDB API attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

async function parseAndEnrichRecommendationsFromAI(text: string, requestedLanguages?: string[], mediaTypes?: string[]): Promise<MovieDetails[]> {
  console.log('AI Response Text:', text);
  console.log('Requested Languages:', requestedLanguages);
  console.log('Media Types:', mediaTypes);
  
  const recommendations: MovieDetails[] = [];
  const processedTitles = new Set();
  const aiRecommendations: MovieRecommendation[] = [];
  
  // If no languages specified, use all patterns
  const languagesToCheck = requestedLanguages?.length ? requestedLanguages : Object.keys(regexPatterns);
  
  // For each requested language
  for (const lang of languagesToCheck) {
    console.log(`Trying patterns for language: ${lang}`);
    const patterns = regexPatterns[lang as LanguageCode];
    if (!patterns) continue;
    
    // Try each pattern for the language
    for (const pattern of patterns) {
      console.log(`Trying pattern: ${pattern}`);
  let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          console.log(`Found match:`, match);
          let title, year, description, genres;
          
          if (match.length === 5) {
            [, title, year, description, genres] = match;
          } else if (match.length === 6) {
            const [, primaryTitle, originalTitle, yearStr, desc, genresStr] = match;
            title = originalTitle ? `${primaryTitle.trim()} (${originalTitle.trim()})` : primaryTitle.trim();
            year = yearStr;
            description = desc;
            genres = genresStr;
          }

          const cleanTitle = title?.trim();
          const cleanYear = year?.trim();
          const cleanDescription = description?.trim();
          const cleanGenres = genres?.split(',').map((g: string) => g.trim()).filter(Boolean) || [];
          
          console.log('Cleaned data:', { cleanTitle, cleanYear, cleanDescription, cleanGenres });

          if (!cleanTitle || !cleanYear || !cleanDescription || cleanGenres.length === 0) {
            console.log('Skipping incomplete match:', { cleanTitle, cleanYear, cleanDescription, genresCount: cleanGenres.length });
            continue;
          }

          const titleKey = cleanTitle.toLowerCase();
          if (!processedTitles.has(titleKey)) {
            processedTitles.add(titleKey);
            console.log('Adding recommendation:', { title: cleanTitle, year: cleanYear, language: lang });
    aiRecommendations.push({
              title: cleanTitle,
              year: cleanYear,
              description: cleanDescription,
              genres: cleanGenres,
              language: lang
            });
          }
        } catch (error) {
          console.error('Error parsing match:', error);
          continue;
        }
      }
    }
  }

  // If no recommendations found, try the fallback pattern
  if (aiRecommendations.length === 0) {
    console.log('No recommendations found with language-specific patterns, trying fallback pattern');
    let match;
    while ((match = fallbackPattern.exec(text)) !== null) {
      try {
        const [, titleWithYear, description, genres] = match;
        // Try to extract year from title
        const yearMatch = titleWithYear.match(/.*\((\d{4})\)/);
        if (!yearMatch) continue;

        const title = titleWithYear.replace(/\(\d{4}\)/, '').trim();
        const year = yearMatch[1];
        const cleanTitle = title.trim();
        const cleanYear = year.trim();
        const cleanDescription = description.trim();
        const cleanGenres = genres.split(',').map((g: string) => g.trim()).filter(Boolean) || [];

        console.log('Fallback pattern match:', { cleanTitle, cleanYear, cleanDescription, cleanGenres });

        if (!cleanTitle || !cleanYear || !cleanDescription || cleanGenres.length === 0) continue;

        const titleKey = cleanTitle.toLowerCase();
        if (!processedTitles.has(titleKey)) {
          processedTitles.add(titleKey);
          aiRecommendations.push({
            title: cleanTitle,
            year: cleanYear,
            description: cleanDescription,
            genres: cleanGenres,
            language: requestedLanguages?.[0] || 'en'
          });
        }
      } catch (error) {
        console.error('Error parsing fallback match:', error);
        continue;
      }
    }
  }

  console.log('Total recommendations parsed:', aiRecommendations.length);

  if (aiRecommendations.length === 0) {
    console.error('No recommendations parsed. Input text:', text);
    throw new Error('Failed to parse recommendations from AI response');
  }

  // Process recommendations and enrich with details
  for (const recommendation of aiRecommendations) {
    console.log('Processing recommendation:', recommendation.title);
    
    const searchResult = await searchExactMovie(
      recommendation.title,
      parseInt(recommendation.year),
      mediaTypes?.[0] || 'movie',
      [recommendation.language]
    );

    if (searchResult) {
      const movieDetails = await enrichMovieWithDetails(searchResult, recommendation.description, requestedLanguages);
      if (movieDetails) {
        recommendations.push({
          ...movieDetails,
          language: recommendation.language
        });
      }
    }
  }

  // Sort recommendations by language priority and plot relevance
  recommendations.sort((a, b) => {
    // First, prioritize requested languages
    const aLanguageMatch = requestedLanguages?.includes(a.language) || false;
    const bLanguageMatch = requestedLanguages?.includes(b.language) || false;
    
    if (aLanguageMatch !== bLanguageMatch) {
      return aLanguageMatch ? -1 : 1;
    }
    
    // Then sort by plot relevance (using the position in the AI's response)
    return a.relevancePosition - b.relevancePosition;
  });

  return recommendations;
}

async function searchExactMovie(title: string, year: number, mediaType: string, requestedLanguages?: string[]): Promise<TMDBResult | null> {
  try {
    // Extract original title if present
    const titleMatch = title.match(/^(.+?)(?: \(([^)]+)\))?$/);
    const englishTitle = titleMatch?.[1]?.trim() || title;
    const originalTitle = titleMatch?.[2]?.trim();

    // Detect languages in the title
    const detectedLanguages = new Set<string>();
    const titleText = originalTitle || englishTitle;

    Object.entries(languageDetectors).forEach(([lang, detector]) => {
      if (detector(titleText)) {
        detectedLanguages.add(lang);
      }
    });

    // Clean the titles
    const cleanEnglishTitle = englishTitle
      .replace(/[.!?…]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`Searching for movie: "${cleanEnglishTitle}"${originalTitle ? ` (${originalTitle})` : ''} (${year}), Detected languages: ${Array.from(detectedLanguages).join(', ')}`);
    
    // Build language filter based on detected and requested languages
    const languageFilter = requestedLanguages?.length 
      ? requestedLanguages.map(lang => languageCodes[lang]).filter(Boolean)
      : Array.from(detectedLanguages).map(lang => languageCodes[lang]);

    // Search parameters with language filter
    const searchParams = {
      query: originalTitle || cleanEnglishTitle,
      year: year.toString(),
      language: 'en-US',
      include_adult: 'false',
      ...(languageFilter.length && { with_original_language: languageFilter.join('|') })
    };

    // First try with the original title if available
    let searchResponse = await fetchFromTMDB(`/search/${mediaType}`, searchParams);

    // If no results with original title, try with English title
    if (!searchResponse?.results?.length && originalTitle) {
      searchResponse = await fetchFromTMDB(`/search/${mediaType}`, {
        ...searchParams,
        query: cleanEnglishTitle
      });
    }

    if (!searchResponse?.results?.length) {
      console.log('No results found with either title');
      return null;
    }

    const results = searchResponse.results;
    console.log(`Found ${results.length} results to analyze`);

    // Filter results to ensure language match
    const filteredResults = languageFilter.length
      ? results.filter((result: TMDBResult) => languageFilter.includes(result.original_language))
      : results;

    if (filteredResults.length === 0) {
      console.log('No results found matching language criteria');
      return null;
    }

    // Find matches with more flexible criteria
    const matches: MovieMatch[] = filteredResults.map((result: TMDBResult) => {
      const resultYear = parseInt((result.release_date || result.first_air_date || '').split('-')[0]);
      const resultTitle = (result.title || result.name || '').toLowerCase();
      const resultOriginalTitle = (result.original_title || result.original_name || '').toLowerCase();
      const searchTitle = cleanEnglishTitle.toLowerCase();
      
      // Calculate similarity scores
      const englishTitleDistance = levenshteinDistance(resultTitle, searchTitle);
      const originalTitleDistance = originalTitle ? 
        levenshteinDistance(resultOriginalTitle, originalTitle.toLowerCase()) : 
        Number.MAX_VALUE;

      const distance = Math.min(englishTitleDistance, originalTitleDistance);
      const maxLength = Math.max(
        resultTitle.length, 
        searchTitle.length,
        originalTitle ? originalTitle.length : 0
      );
      let similarity = 1 - (distance / maxLength);

      if (originalTitle && resultOriginalTitle === originalTitle.toLowerCase()) {
        similarity = 1;
      }

      if (resultTitle.includes(searchTitle) || searchTitle.includes(resultTitle) ||
          (originalTitle && (resultOriginalTitle.includes(originalTitle.toLowerCase()) || 
           originalTitle.toLowerCase().includes(resultOriginalTitle)))) {
        similarity = Math.min(1, similarity + 0.2);
      }

      const yearDiff = Math.abs(resultYear - year);

      return {
        result,
        similarity,
        yearDiff,
        yearMatch: yearDiff <= 2,
        resultTitle,
        resultYear,
        languageMatch: languageFilter.includes(result.original_language)
      };
    });

    // Sort matches
    matches.sort((a, b) => {
      // Prioritize language matches
      if (a.languageMatch !== b.languageMatch) {
        return b.languageMatch ? 1 : -1;
      }
      // Then check similarity and year
      if (Math.abs(a.similarity - b.similarity) < 0.1) {
        return a.yearDiff - b.yearDiff;
      }
      return b.similarity - a.similarity;
    });

    matches.slice(0, 3).forEach((match: MovieMatch) => {
      console.log(`Match: "${match.resultTitle}" (${match.resultYear}) - Similarity: ${match.similarity.toFixed(2)}, Year diff: ${match.yearDiff}, Language: ${match.result.original_language}`);
    });

    const bestMatch = matches.find((match: MovieMatch) => 
      match.languageMatch && (
        (match.similarity > 0.6 && match.yearDiff <= 2) ||
        (match.similarity > 0.8)
      )
    );

    if (bestMatch) {
      console.log(`Selected best match: "${bestMatch.resultTitle}" (${bestMatch.resultYear}), Language: ${bestMatch.result.original_language}, Original title: ${bestMatch.result.original_title}`);
      return bestMatch.result;
    }

    console.log('No suitable match found');
    return null;
  } catch (error) {
    console.error(`Error searching for movie "${title}":`, error);
    return null;
  }
}

async function enrichMovieWithDetails(
  movie: TMDBResult,
  description: string,
  requestedLanguages?: string[]
): Promise<MovieDetails | null> {
  try {
    const mediaType = movie.first_air_date ? 'tv' : 'movie';
    const details = await fetchFromTMDB(
      `/${mediaType}/${movie.id}`,
      { append_to_response: 'credits' }
    );

    if (!details) return null;

    const releaseDate = movie.release_date || movie.first_air_date;
    const director = details.credits?.crew?.find((c: TMDBCredit) => c.job === 'Director')?.name || '';
    const cast = details.credits?.cast?.slice(0, 5)?.map((c: TMDBCredit) => c.name) || [];

    return {
      id: movie.id.toString(),
      title: movie.title || movie.name || '',
      overview: description || movie.overview,
      posterPath: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
      releaseDate: releaseDate || null,
      genres: details.genres?.map((g: TMDBGenre) => g.name) || [],
      originalLanguage: movie.original_language,
      voteAverage: movie.vote_average,
      cast,
      director,
      imdbId: details.imdb_id || null,
      tmdbId: movie.id.toString(),
      tmdbUrl: `https://www.themoviedb.org/${mediaType}/${movie.id}`,
      imdbUrl: details.imdb_id ? `https://www.imdb.com/title/${details.imdb_id}` : null,
      relevancePosition: 0,
      mediaType,
      type: mediaType === 'movie' ? 'movie' : 'webseries',
      language: requestedLanguages?.[0] || 'en'
    };
  } catch (error) {
    console.error(`Error enriching movie details for "${movie.title || movie.name}":`, error);
    return null;
  }
}

function buildMoviePreferences(data: RecommendationRequest) {
  return {
    mediaType: data.contentType || [],
    languages: data.languages || [],
    genres: data.genres || [],
    plotPreference: data.plot || '',
    similarMovies: data.similarMovies?.split(',').map((m: string) => m.trim()) || [],
    preferredYear: data.preferredYear || '',
    preferredCast: data.cast?.split(',').map((c: string) => c.trim()) || [],
    minImdbRating: data.rating ? parseFloat(data.rating) : undefined,
    allowAdult: data.mature || false
  };
}

async function getPopularMoviesByGenreAndLanguage(genres: string[], languages: string[], mediaType: string, year: number): Promise<MovieDetails[]> {
  console.log('Fetching popular movies by genre and language...');
  const tmdbGenres = await getTMDBGenres(mediaType);
  const genreIds = genres.map(genre => {
    const match = tmdbGenres.find(g => g.name.toLowerCase() === genre.toLowerCase());
    return match ? match.id : null;
  }).filter((id): id is number => id !== null);

  if (genreIds.length === 0) {
    console.log('No matching genre IDs found');
    return [];
  }

  try {
    // Get multiple pages of results for more variety
    const pages = 3;
    let allResults: TMDBResult[] = [];

    for (let page = 1; page <= pages; page++) {
      const url = new URL(`https://api.themoviedb.org/3/discover/${mediaType}`);
      url.searchParams.append('api_key', process.env.TMDB_API_KEY || '');
      url.searchParams.append('with_genres', genreIds.join('|'));
      url.searchParams.append('page', page.toString());
      url.searchParams.append('sort_by', 'popularity.desc');
      url.searchParams.append('include_adult', 'false');
      
      if (languages?.length) {
        url.searchParams.append('with_original_language', languages.join('|'));
      }
      
      if (year > 0) {
        url.searchParams.append('primary_release_year', year.toString());
      }

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`TMDB API error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      if (Array.isArray(data.results)) {
        allResults = [...allResults, ...data.results];
      }
    }

    // Filter and sort by popularity
    const filteredResults = allResults
      .filter(movie => {
        if (!movie.release_date) return false;
        const movieYear = new Date(movie.release_date).getFullYear();
        return !year || Math.abs(movieYear - year) <= 2;
      })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 5);

    // Convert to MovieDetails format
    const recommendations: MovieDetails[] = [];
    for (const movie of filteredResults) {
      const details = await enrichMovieWithDetails(movie, '', languages);
      if (details) {
        recommendations.push(details);
      }
    }

    return recommendations;
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return [];
  }
}

async function getTMDBGenres(mediaType: string): Promise<{ id: number; name: string }[]> {
  try {
    const url = new URL(`https://api.themoviedb.org/3/genre/${mediaType}/list`);
    url.searchParams.append('api_key', process.env.TMDB_API_KEY || '');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.genres;
  } catch (error) {
    console.error('Error fetching TMDB genres:', error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const preferences = buildMoviePreferences(data);
    const aiService = new AIService();
    
    const recommendations = await aiService.getRecommendations(preferences);
    
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Error in recommendations route:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + substitutionCost
      );
    }
  }
  return matrix[b.length][a.length];
}

