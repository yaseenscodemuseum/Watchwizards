import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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

export interface RecommendationRequest {
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

export interface MovieDetails {
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
  matchType?: 'EXACT' | 'CLOSE' | undefined;
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

interface MovieRecommendation {
  title: string;
  year: string;
  description: string;
  genres: string[];
  language: string;
  matchType?: 'EXACT' | 'CLOSE' | undefined;
}

interface MoviePreference {
  mediaType: string[];
  languages: string[];
  genres: string[];
  plotPreference?: string;
  similarMovies?: string[];
  preferredYear?: string;
  preferredCast?: string[];
  minImdbRating?: number;
  allowAdult: boolean;
}

// TMDB API configuration
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// The app's contentType values are 'movie' | 'webseries'; TMDB endpoints only
// accept 'movie' | 'tv'. Returns the TMDB types to search, in priority order.
function toTmdbMediaTypes(mediaTypes?: string[]): string[] {
  const wantsMovies = mediaTypes?.includes('movie');
  const wantsSeries = mediaTypes?.includes('webseries');
  if (wantsSeries && !wantsMovies) return ['tv'];
  if (wantsSeries && wantsMovies) return ['movie', 'tv'];
  return ['movie'];
}

// ---------------------------------------------------------------------------
// Structured output schema — every provider is constrained to return this
// exact JSON shape, so no text parsing is ever needed.
// ---------------------------------------------------------------------------

// Strict-mode JSON Schema (Claude, OpenAI, and embedded in the DeepSeek prompt).
// All fields are required and additionalProperties is false because OpenAI's
// strict mode demands it; "not applicable" is expressed with "" / "NONE".
const recommendationJsonSchema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      description: 'Exactly 5 movie or series recommendations',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Original title in its native script (e.g. 기생충)'
          },
          englishTitle: {
            type: 'string',
            description: 'English title, or an empty string if identical to title'
          },
          year: {
            type: 'string',
            description: 'First release year, e.g. "2019"'
          },
          description: {
            type: 'string',
            description: 'Two sentences: a plot summary, then why it matches the user preferences'
          },
          genres: {
            type: 'array',
            items: { type: 'string' }
          },
          language: {
            type: 'string',
            description: 'ISO 639-1 code of the original language, e.g. "ko"'
          },
          matchType: {
            type: 'string',
            enum: ['EXACT', 'CLOSE', 'NONE'],
            description: 'EXACT if the requested plot element is central to the story, CLOSE if significant, NONE if no plot preference was given'
          }
        },
        required: ['title', 'englishTitle', 'year', 'description', 'genres', 'language', 'matchType'],
        additionalProperties: false
      }
    }
  },
  required: ['recommendations'],
  additionalProperties: false
} as const;

// Same schema in Gemini's responseSchema dialect
const geminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    recommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          englishTitle: { type: SchemaType.STRING },
          year: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          genres: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          language: { type: SchemaType.STRING },
          matchType: { type: SchemaType.STRING, format: 'enum', enum: ['EXACT', 'CLOSE', 'NONE'] }
        },
        required: ['title', 'englishTitle', 'year', 'description', 'genres', 'language', 'matchType']
      }
    }
  },
  required: ['recommendations']
};

// Validate/normalize whatever a provider returned into MovieRecommendation[]
function normalizeRecommendations(raw: unknown): MovieRecommendation[] {
  const items = (raw as { recommendations?: unknown })?.recommendations;
  if (!Array.isArray(items)) {
    throw new Error('AI response is missing the "recommendations" array');
  }

  const normalized: MovieRecommendation[] = [];
  for (const item of items) {
    const title = String(item?.title || '').trim();
    const englishTitle = String(item?.englishTitle || '').trim();
    const year = String(item?.year || '').match(/\d{4}/)?.[0] || '';
    const description = String(item?.description || '').trim();
    const genres = Array.isArray(item?.genres)
      ? item.genres.map((g: unknown) => String(g).trim()).filter(Boolean)
      : [];
    const language = String(item?.language || 'en').trim().toLowerCase().slice(0, 2);
    const matchType = item?.matchType === 'EXACT' ? 'EXACT' as const
      : item?.matchType === 'CLOSE' ? 'CLOSE' as const
      : undefined;

    if (!title || !year || !description || genres.length === 0) {
      console.log('Skipping incomplete recommendation:', item);
      continue;
    }

    const combinedTitle = englishTitle && englishTitle.toLowerCase() !== title.toLowerCase()
      ? `${title} (${englishTitle})`
      : title;

    normalized.push({ title: combinedTitle, year, description, genres, language, matchType });
  }

  if (normalized.length === 0) {
    throw new Error('AI response contained no usable recommendations');
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// AI providers — each is only attempted when its API key is configured.
// Order is best-quality first: Claude -> Gemini -> OpenAI -> DeepSeek.
// ---------------------------------------------------------------------------

type Provider = {
  name: string;
  configured: () => boolean;
  generate: (prompt: string) => Promise<MovieRecommendation[]>;
};

async function claudeGenerate(prompt: string): Promise<MovieRecommendation[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: recommendationJsonSchema as unknown as Record<string, unknown>
      }
    }
  });
  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }
  return normalizeRecommendations(JSON.parse(textBlock.text));
}

async function geminiGenerate(prompt: string): Promise<MovieRecommendation[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: geminiResponseSchema as any
    }
  });
  const result = await model.generateContent(prompt);
  return normalizeRecommendations(JSON.parse(result.response.text()));
}

async function openaiGenerate(prompt: string): Promise<MovieRecommendation[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'movie_recommendations',
        strict: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: recommendationJsonSchema as any
      }
    }
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response');
  return normalizeRecommendations(JSON.parse(text));
}

async function deepseekGenerate(prompt: string): Promise<MovieRecommendation[]> {
  // OpenRouter only guarantees valid JSON (json_object), not schema conformance,
  // so the schema is embedded in the prompt and enforced by normalize.
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://watchwizards.vercel.app/',
      'X-Title': 'WatchWizards'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
      messages: [{
        role: 'user',
        content: `${prompt}\n\nRespond ONLY with a JSON object matching this JSON Schema exactly:\n${JSON.stringify(recommendationJsonSchema)}`
      }],
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from DeepSeek');
  return normalizeRecommendations(JSON.parse(text));
}

const providers: Provider[] = [
  { name: 'Claude', configured: () => !!process.env.ANTHROPIC_API_KEY, generate: claudeGenerate },
  { name: 'Gemini', configured: () => !!process.env.GEMINI_API_KEY, generate: geminiGenerate },
  { name: 'OpenAI', configured: () => !!process.env.OPENAI_API_KEY, generate: openaiGenerate },
  { name: 'DeepSeek', configured: () => !!process.env.OPENROUTER_API_KEY, generate: deepseekGenerate },
];

async function getStructuredRecommendations(prompt: string): Promise<MovieRecommendation[]> {
  const available = providers.filter(p => p.configured());
  if (available.length === 0) {
    throw new Error('No AI provider is configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY.');
  }

  let lastError: unknown = null;
  for (const provider of available) {
    try {
      console.log(`Trying ${provider.name}...`);
      const recommendations = await provider.generate(prompt);
      console.log(`${provider.name} returned ${recommendations.length} recommendations`);
      return recommendations;
    } catch (error) {
      console.error(`${provider.name} failed:`, error);
      lastError = error;
    }
  }
  throw new Error(`All configured AI providers failed (${available.map(p => p.name).join(', ')}). Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

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

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();

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

async function enrichRecommendations(
  aiRecommendations: MovieRecommendation[],
  requestedLanguages?: string[],
  mediaTypes?: string[]
): Promise<MovieDetails[]> {
  const recommendations: MovieDetails[] = [];
  const processedTitles = new Set<string>();

  // Filter to requested languages (trust the model's language field) and dedupe
  const filtered = aiRecommendations.filter(rec => {
    if (requestedLanguages?.length && !requestedLanguages.includes(rec.language)) {
      console.log(`Skipping ${rec.title}: language ${rec.language} not requested`);
      return false;
    }
    const key = `${rec.title.toLowerCase()}-${rec.year}`;
    if (processedTitles.has(key)) return false;
    processedTitles.add(key);
    return true;
  });

  // Verify each recommendation against TMDB and enrich with full details
  let position = 0;
  for (const recommendation of filtered) {
    console.log('Processing recommendation:', recommendation.title);

    // Try each requested TMDB type until one matches (movie-first when both)
    let searchResult: TMDBResult | null = null;
    for (const tmdbType of toTmdbMediaTypes(mediaTypes)) {
      searchResult = await searchExactMovie(
        recommendation.title,
        parseInt(recommendation.year),
        tmdbType,
        [recommendation.language]
      );
      if (searchResult) break;
    }

    if (searchResult) {
      const movieDetails = await enrichMovieWithDetails(searchResult, recommendation.description, requestedLanguages);
      if (movieDetails) {
        recommendations.push({
          ...movieDetails,
          relevancePosition: position++,
          language: recommendation.language,
          matchType: recommendation.matchType
        });
      }
    }
  }

  // Sort by match type, language priority, then original relevance order
  recommendations.sort((a, b) => {
    if (a.matchType === 'EXACT' && b.matchType !== 'EXACT') return -1;
    if (a.matchType !== 'EXACT' && b.matchType === 'EXACT') return 1;
    if (a.matchType === 'CLOSE' && b.matchType !== 'CLOSE') return -1;
    if (a.matchType !== 'CLOSE' && b.matchType === 'CLOSE') return 1;

    const aLanguageMatch = requestedLanguages?.includes(a.language) || false;
    const bLanguageMatch = requestedLanguages?.includes(b.language) || false;
    if (aLanguageMatch !== bLanguageMatch) {
      return aLanguageMatch ? -1 : 1;
    }

    return a.relevancePosition - b.relevancePosition;
  });

  // Ensure even distribution across languages if multiple languages are requested
  if (requestedLanguages?.length && requestedLanguages.length > 1) {
    const maxPerLanguage = Math.ceil(5 / requestedLanguages.length);
    const languageGroups: Record<string, MovieDetails[]> = {};

    recommendations.forEach(rec => {
      if (!languageGroups[rec.language]) {
        languageGroups[rec.language] = [];
      }
      languageGroups[rec.language].push(rec);
    });

    const balancedRecommendations: MovieDetails[] = [];
    requestedLanguages.forEach(lang => {
      const langRecs = languageGroups[lang] || [];
      balancedRecommendations.push(...langRecs.slice(0, maxPerLanguage));
    });

    const remaining = recommendations.filter(rec => !balancedRecommendations.includes(rec));
    balancedRecommendations.push(...remaining.slice(0, Math.max(0, 5 - balancedRecommendations.length)));

    return balancedRecommendations;
  }

  return recommendations;
}

async function searchExactMovie(title: string, year: number, mediaType: string, requestedLanguages?: string[]): Promise<TMDBResult | null> {
  try {
    // Extract original title if present: "Original (English)"
    const titleMatch = title.match(/^(.+?)(?: \(([^)]+)\))?$/);
    const originalTitle = titleMatch?.[1]?.trim() || title;
    const englishTitle = titleMatch?.[2]?.trim();

    // Clean the titles
    const cleanOriginalTitle = originalTitle
      .replace(/[.!?…]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanEnglishTitle = englishTitle
      ? englishTitle
          .replace(/[.!?…]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
      : null;

    console.log(`Searching for movie: "${cleanOriginalTitle}"${cleanEnglishTitle ? ` (${cleanEnglishTitle})` : ''} (${year})`);

    // Search parameters - try with original title first
    const searchParams = {
      query: cleanOriginalTitle,
      year: year.toString(),
      language: 'en-US',
      include_adult: 'false',
      ...(requestedLanguages?.length && { with_original_language: requestedLanguages.join('|') })
    };

    // First try with the original title
    let searchResponse = await fetchFromTMDB(`/search/${mediaType}`, searchParams);

    // If no results with original title and we have an English title, try that
    if (!searchResponse?.results?.length && cleanEnglishTitle) {
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

    // Find matches with more flexible criteria
    const matches: MovieMatch[] = results.map((result: TMDBResult) => {
      const resultYear = parseInt((result.release_date || result.first_air_date || '').split('-')[0]);
      const resultOriginalTitle = (result.original_title || result.original_name || '').trim();
      const resultEnglishTitle = (result.title || result.name || '').trim().toLowerCase();

      // Calculate similarity scores
      let similarity = 0;

      // Check exact matches first
      if (resultOriginalTitle === cleanOriginalTitle) {
        similarity = 1;
      } else if (cleanEnglishTitle && resultEnglishTitle === cleanEnglishTitle) {
        similarity = 1;
      } else {
        // Calculate Levenshtein distance for original titles
        const originalDistance = levenshteinDistance(
          resultOriginalTitle.toLowerCase(),
          cleanOriginalTitle.toLowerCase()
        );
        const maxLength = Math.max(resultOriginalTitle.length, cleanOriginalTitle.length);
        similarity = maxLength > 0 ? 1 - (originalDistance / maxLength) : 0;

        // If we have an English title, also check that
        if (cleanEnglishTitle) {
          const englishDistance = levenshteinDistance(
            resultEnglishTitle,
            cleanEnglishTitle
          );
          const englishMaxLength = Math.max(resultEnglishTitle.length, cleanEnglishTitle.length);
          const englishSimilarity = englishMaxLength > 0 ? 1 - (englishDistance / englishMaxLength) : 0;
          similarity = Math.max(similarity, englishSimilarity);
        }
      }

      // Boost similarity for year match
      if (Math.abs(resultYear - year) <= 1) {
        similarity = Math.min(1, similarity + 0.2);
      }

      const yearDiff = Math.abs(resultYear - year);

      return {
        result,
        similarity,
        yearDiff,
        yearMatch: yearDiff <= 1,
        resultTitle: resultEnglishTitle,
        resultYear,
        languageMatch: requestedLanguages?.includes(result.original_language) || false
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
        (match.similarity > 0.7 && match.yearDiff <= 1) ||
        (match.similarity > 0.9)
      )
    );

    if (bestMatch) {
      console.log(`Selected best match: "${bestMatch.resultTitle}" (${bestMatch.resultYear}), Language: ${bestMatch.result.original_language}`);
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

export class AIService {
  async getRecommendations(options: MoviePreference, customPrompt?: string): Promise<{ results: MovieDetails[] }> {
    const prompt = customPrompt || this.getAIPrompt(options);

    try {
      const aiRecommendations = await getStructuredRecommendations(prompt);
      const recommendations = await enrichRecommendations(aiRecommendations, options.languages, options.mediaType);

      if (!recommendations?.length) {
        // If no exact matches found, try fallback to popular movies
        console.log("No exact matches found, trying fallback to popular movies...");
        const firstYear = parseInt((options.preferredYear || '').match(/\d{4}/)?.[0] || '0');
        const fallbackRecommendations = await getPopularMoviesByGenreAndLanguage(
          options.genres,
          options.languages,
          toTmdbMediaTypes(options.mediaType)[0],
          firstYear
        );

        if (fallbackRecommendations.length > 0) {
          console.log(`Found ${fallbackRecommendations.length} fallback recommendations`);
          return { results: fallbackRecommendations };
        }

        throw new Error('No recommendations found that match your criteria');
      }

      return { results: recommendations };
    } catch (error) {
      console.error('Error in getRecommendations:', error);
      throw error;
    }
  }

  private getAIPrompt(options: MoviePreference) {
    const wantsSeries = options.mediaType?.includes('webseries');
    const wantsMovies = options.mediaType?.includes('movie') || !wantsSeries;
    const contentLabel = wantsSeries && wantsMovies
      ? 'titles (a mix of movies AND TV series)'
      : wantsSeries
        ? 'TV series'
        : 'movies';

    const seriesGuidance = wantsSeries
      ? `
Series rules (IMPORTANT):
- Recommend the SERIES itself, never an individual season, episode, or spin-off film
- Prefer complete or critically acclaimed series with strong endings; note limited series when they fit best
- Consider commitment level: mention in the description whether it is a limited series, a single-season gem, or a long-running show
- Include international series (K-dramas, anime, European and South Asian series) when they fit the language and genre preferences
- year is the year the series FIRST aired${wantsMovies ? '\n- Balance the 5 recommendations between movies and series' : ''}`
      : '';

    return `You are an expert film and television curator with deep knowledge of global cinema and prestige TV. Recommend EXACTLY 5 real, existing, well-regarded ${contentLabel} that match the user's preferences. Every recommendation must be a real title that exists in TMDB.
${seriesGuidance}

User preferences (in priority order):
${options.plotPreference ? `1. PLOT ELEMENTS (HIGHEST PRIORITY): "${options.plotPreference}"
   - Find titles where this plot element is central to the story
   - Set matchType to EXACT when the plot element is the main focus, CLOSE when it is significant but not central` : '1. No specific plot preference — set matchType to NONE for every recommendation'}
2. LANGUAGES: ${options.languages.join(', ') || 'any'}
   - Every recommendation MUST be originally made in one of these languages
   - Distribute recommendations evenly across the requested languages
3. GENRES: ${options.genres.join(', ') || 'any'}
${options.similarMovies?.length ? `4. SIMILAR TO: ${options.similarMovies.join(', ')} — consider plot structure, themes, tone, and style` : ''}
${options.preferredYear ? `5. PREFERRED YEAR: ${options.preferredYear} (this may be a single year, a range like 2020-2025, or a list like 2020, 2023 — recommend titles from within these years, ±2 years is acceptable)` : ''}
${options.preferredCast?.length ? `6. NOTABLE CAST/CREW: ${options.preferredCast.join(', ')}` : ''}
${options.minImdbRating ? `7. MINIMUM RATING: ${options.minImdbRating}+` : ''}
8. MATURE CONTENT: ${options.allowAdult ? 'Allowed' : 'Excluded'}

Field guidance:
- title: the original title in its native script (e.g. 기생충, 千と千尋の神隠し)
- englishTitle: the English release title, or "" if the original title is already English
- language: the ISO 639-1 code of the original language (en, ko, ja, hi, fr, de, es, ur, ...)
- description: two sentences — first a plot summary, then why it matches the preferences
- year: the first release year${wantsSeries ? ' (first air date year for series)' : ''}`;
  }
}

export function buildMoviePreferences(data: RecommendationRequest): MoviePreference {
  return {
    mediaType: data.contentType || [],
    languages: data.languages || [],
    genres: data.genres || [],
    plotPreference: data.plot || '',
    similarMovies: data.similarMovies?.split(',').map((m: string) => m.trim()).filter(Boolean) || [],
    preferredYear: data.preferredYear || '',
    preferredCast: data.cast?.split(',').map((c: string) => c.trim()).filter(Boolean) || [],
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
        url.searchParams.append(
          mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year',
          year.toString()
        );
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
        const date = movie.release_date || movie.first_air_date;
        if (!date) return false;
        const movieYear = new Date(date).getFullYear();
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
    return data.genres || [];
  } catch (error) {
    console.error('Error fetching TMDB genres:', error);
    return [];
  }
}

export function levenshteinDistance(a: string, b: string): number {
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
