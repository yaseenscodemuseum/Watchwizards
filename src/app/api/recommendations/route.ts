import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import axios from 'axios';

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

// Optimized regex pattern that better handles plot descriptions and match types
const regexPattern = /\*\s*([^()]+?)(?:\s*\(([^)]+?)\))?\s*\((\d{4})\)\s*-\s*([^|]+?)(?:\s*-\s*(?:EXACT|CLOSE)\s*MATCH\s*[^|]+?)?\s*\|\s*Genres:\s*([^\n]+)/gm;

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
  const languageCounts: Record<string, number> = {};
  
  // Initialize language counts
  if (requestedLanguages?.length) {
    requestedLanguages.forEach(lang => {
      languageCounts[lang] = 0;
    });
  }
  
  // Parse recommendations using the optimized pattern
  let match;
  while ((match = regexPattern.exec(text)) !== null) {
    try {
      console.log(`Found match:`, match);
      const [, originalTitle, englishTitle, year, description, genres] = match;
      
      // Extract match type from description if present
      const matchType = description.includes('EXACT MATCH') ? 'EXACT' : 
                       description.includes('CLOSE MATCH') ? 'CLOSE' : undefined;
      
      // Clean up the description by removing the match type if present
      const cleanDescription = description
        .replace(/\s*-\s*(?:EXACT|CLOSE)\s*MATCH\s*[^|]+?$/, '')
        .trim();
      
      const cleanOriginalTitle = originalTitle.trim();
      const cleanEnglishTitle = englishTitle?.trim();
      const cleanYear = year.trim();
      const cleanGenres = genres.split(',').map(g => g.trim()).filter(Boolean);
      
      console.log('Cleaned data:', { 
        cleanOriginalTitle, 
        cleanEnglishTitle, 
        cleanYear, 
        cleanDescription, 
        cleanGenres,
        matchType 
      });

      if (!cleanOriginalTitle || !cleanYear || !cleanDescription || cleanGenres.length === 0) {
        console.log('Skipping incomplete match:', { 
          cleanOriginalTitle, 
          cleanYear, 
          cleanDescription, 
          genresCount: cleanGenres.length 
        });
        continue;
      }

      // Detect language from the original title
      const detectedLanguage = Object.entries(languageDetectors).find(([_, detector]) => 
        detector(cleanOriginalTitle)
      )?.[0] || 'en';

      // Skip if language doesn't match requested languages
      if (requestedLanguages?.length && !requestedLanguages.includes(detectedLanguage)) {
        console.log(`Skipping ${detectedLanguage} movie as it's not in requested languages`);
        continue;
      }

      const titleKey = `${cleanOriginalTitle.toLowerCase()}-${cleanYear}`;
      if (!processedTitles.has(titleKey)) {
        processedTitles.add(titleKey);
        console.log('Adding recommendation:', { 
          originalTitle: cleanOriginalTitle, 
          englishTitle: cleanEnglishTitle,
          year: cleanYear, 
          language: detectedLanguage,
          matchType
        });
    
    aiRecommendations.push({
          title: cleanEnglishTitle ? `${cleanOriginalTitle} (${cleanEnglishTitle})` : cleanOriginalTitle,
          year: cleanYear,
          description: cleanDescription,
          genres: cleanGenres,
          language: detectedLanguage,
          matchType
        });
        languageCounts[detectedLanguage] = (languageCounts[detectedLanguage] || 0) + 1;
      }
    } catch (error) {
      console.error('Error parsing match:', error);
      continue;
    }
  }

  // Sort recommendations by match type if plot preference is present
  if (aiRecommendations.some(rec => rec.matchType)) {
    aiRecommendations.sort((a, b) => {
      if (a.matchType === 'EXACT' && b.matchType !== 'EXACT') return -1;
      if (a.matchType !== 'EXACT' && b.matchType === 'EXACT') return 1;
      if (a.matchType === 'CLOSE' && b.matchType !== 'CLOSE') return -1;
      if (a.matchType !== 'CLOSE' && b.matchType === 'CLOSE') return 1;
      return 0;
    });
  }

  console.log('Total recommendations parsed:', aiRecommendations.length);
  console.log('Language distribution:', languageCounts);

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
          language: recommendation.language,
          matchType: recommendation.matchType
        });
      }
    }
  }

  // Sort recommendations by match type, language priority, and plot relevance
  recommendations.sort((a, b) => {
    // First, prioritize match type
    if (a.matchType === 'EXACT' && b.matchType !== 'EXACT') return -1;
    if (a.matchType !== 'EXACT' && b.matchType === 'EXACT') return 1;
    if (a.matchType === 'CLOSE' && b.matchType !== 'CLOSE') return -1;
    if (a.matchType !== 'CLOSE' && b.matchType === 'CLOSE') return 1;
    
    // Then, prioritize requested languages
    const aLanguageMatch = requestedLanguages?.includes(a.language) || false;
    const bLanguageMatch = requestedLanguages?.includes(b.language) || false;
    
    if (aLanguageMatch !== bLanguageMatch) {
      return aLanguageMatch ? -1 : 1;
    }
    
    // Finally, sort by plot relevance
    return a.relevancePosition - b.relevancePosition;
  });

  // Ensure even distribution across languages if multiple languages are requested
  if (requestedLanguages?.length && requestedLanguages.length > 1) {
    const maxPerLanguage = Math.ceil(5 / requestedLanguages.length);
    const languageGroups: Record<string, MovieDetails[]> = {};
    
    // Group recommendations by language
    recommendations.forEach(rec => {
      if (!languageGroups[rec.language]) {
        languageGroups[rec.language] = [];
      }
      languageGroups[rec.language].push(rec);
    });
    
    // Take recommendations from each language group
    const balancedRecommendations: MovieDetails[] = [];
    requestedLanguages.forEach(lang => {
      const langRecs = languageGroups[lang] || [];
      balancedRecommendations.push(...langRecs.slice(0, maxPerLanguage));
    });
    
    // Add any remaining recommendations to fill up to 5
    const remaining = recommendations.filter(rec => !balancedRecommendations.includes(rec));
    balancedRecommendations.push(...remaining.slice(0, 5 - balancedRecommendations.length));
    
    return balancedRecommendations;
  }

  return recommendations;
}

async function searchExactMovie(title: string, year: number, mediaType: string, requestedLanguages?: string[]): Promise<TMDBResult | null> {
  try {
    // Extract original title if present
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
        similarity = 1 - (originalDistance / maxLength);

        // If we have an English title, also check that
        if (cleanEnglishTitle) {
          const englishDistance = levenshteinDistance(
            resultEnglishTitle,
            cleanEnglishTitle
          );
          const englishMaxLength = Math.max(resultEnglishTitle.length, cleanEnglishTitle.length);
          const englishSimilarity = 1 - (englishDistance / englishMaxLength);
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

class AIService {
  async getRecommendations(options: MoviePreference, customPrompt?: string): Promise<{ results: MovieDetails[] }> {
    let text = '';
    const prompt = customPrompt || this.getAIPrompt(options);

    // Try each AI service in sequence
    try {
      // Try Gemini first
      try {
        console.log("Trying Gemini...");
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();
        console.log("Gemini response received");
      } catch (error: any) {
        console.log("Gemini error:", error);
        
        // Try OpenAI as first fallback
        try {
          console.log("Trying OpenAI...");
          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
          });
          text = completion.choices[0]?.message?.content || '';
          console.log("OpenAI response received");
        } catch (openaiError: any) {
          console.log("OpenAI error:", openaiError);

          // Try DeepSeek as second fallback
          try {
            console.log("Trying DeepSeek...");
            const deepseekResponse = await fetch('https://api.openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://watchwizards.vercel.app/',
                'X-Title': 'WatchWizards'
              },
              body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [{ role: 'user', content: prompt }]
              })
            });

            if (!deepseekResponse.ok) {
              throw new Error(`DeepSeek API error: ${deepseekResponse.status} ${deepseekResponse.statusText}`);
            }

            const deepseekData = await deepseekResponse.json();
            text = deepseekData.choices?.[0]?.message?.content || '';
            if (!text) {
              throw new Error('Empty response from DeepSeek');
            }
            console.log("DeepSeek response received");
          } catch (deepseekError: any) {
            console.log("DeepSeek error:", deepseekError);
            throw new Error('All AI services failed');
          }
        }
      }

      if (!text) {
        throw new Error('Failed to generate recommendations from any AI service');
      }

      console.log("AI response:", text);
      const recommendations = await parseAndEnrichRecommendationsFromAI(text, options.languages, options.mediaType);

      if (!recommendations?.length || recommendations.length === 0) {
        // If no exact matches found, try fallback to popular movies
        console.log("No exact matches found, trying fallback to popular movies...");
        const fallbackRecommendations = await getPopularMoviesByGenreAndLanguage(
          options.genres,
          options.languages,
          options.mediaType?.[0] || 'movie',
          parseInt(options.preferredYear || '0')
        );

        if (fallbackRecommendations.length > 0) {
          console.log(`Found ${fallbackRecommendations.length} fallback recommendations`);
          return { results: fallbackRecommendations };
        }

        throw new Error('No recommendations found that match your criteria');
      }

      return { results: recommendations };
    } catch (error: any) {
      console.error('Error in getRecommendations:', error);
      throw error;
    }
  }

  private getAIPrompt(options: MoviePreference) {
    const plotExamples = {
      revenge: [
        "* 올드보이 (Oldboy) (2003) - A man imprisoned for 15 years seeks revenge against his mysterious captor, uncovering shocking truths. EXACT MATCH for revenge theme - the entire plot revolves around revenge and its consequences. | Genres: Mystery, Thriller, Drama",
        "* Lady Vengeance (2005) - A woman wrongfully imprisoned plots an elaborate revenge against the man who framed her, methodically gathering allies. CLOSE MATCH - focuses on meticulous revenge planning and execution. | Genres: Crime, Drama, Thriller"
      ],
      timeTravel: [
        "* 時をかける少女 (The Girl Who Leapt Through Time) (2006) - A high school girl discovers she can jump through time, but learns that changing the past has consequences. EXACT MATCH - entire plot revolves around time travel and its effects. | Genres: Animation, Sci-Fi, Romance",
        "* Steins;Gate (2011) - A self-proclaimed mad scientist accidentally invents time travel through modified microwave, leading to devastating consequences. CLOSE MATCH - explores time travel mechanics and consequences. | Genres: Sci-Fi, Thriller, Drama"
      ],
      comingOfAge: [
        "* Les Quatre Cents Coups (The 400 Blows) (1959) - A troubled young boy in Paris struggles with family issues and school, seeking his own path in life. EXACT MATCH - entire film focuses on a young boy's journey to adulthood. | Genres: Drama",
        "* 3 Idiots (2009) - Three engineering students challenge the academic system while discovering their true passions and friendship. CLOSE MATCH - follows young adults finding their place in the world. | Genres: Comedy, Drama"
      ]
    };

    const languageExamples = {
      en: [
        "* The Godfather (1972) - A crime family's patriarch transfers control to his reluctant son, exploring themes of power and family loyalty. Similar to 'Goodfellas' in its portrayal of organized crime. | Genres: Crime, Drama",
        "* Inception (2010) - A skilled thief uses dream-sharing technology to plant ideas in people's minds. Similar to 'The Matrix' in its reality-bending concept. | Genres: Sci-Fi, Action, Thriller"
      ],
      ko: [
        "* 기생충 (Parasite) (2019) - A poor family infiltrates a wealthy household, leading to an unpredictable series of events that mirror class inequality. Similar to 'Shoplifters' in examining social disparity. | Genres: Drama, Thriller",
        "* 아가씨 (The Handmaiden) (2016) - A complex tale of deception and romance in colonial Korea, with twists reminiscent of 'Gone Girl'. | Genres: Drama, Romance, Thriller"
      ],
      ja: [
        "* 千と千尋の神隠し (Spirited Away) (2001) - A young girl must work in a supernatural bathhouse to save her parents, exploring themes of identity and courage like 'Alice in Wonderland'. | Genres: Animation, Adventure, Fantasy",
        "* 七人の侍 (Seven Samurai) (1954) - Masterful tale of samurai defending a village, which inspired 'The Magnificent Seven'. | Genres: Action, Drama"
      ],
      hi: [
        "* दंगल (Dangal) (2016) - Based on a true story of a father training his daughters to become wrestlers, challenging gender norms like 'Million Dollar Baby'. | Genres: Biography, Drama, Sport",
        "* लगान (Lagaan) (2001) - A village stakes their future on a cricket match against British rulers, similar to 'The Longest Yard' in sports vs authority theme. | Genres: Drama, Sport"
      ],
      fr: [
        "* Amélie (2001) - A whimsical woman secretly improves others' lives, sharing themes of human connection with 'Cinema Paradiso'. | Genres: Comedy, Romance",
        "* La Haine (1995) - Raw portrayal of youth in Paris suburbs, similar to 'Do the Right Thing' in examining social tensions. | Genres: Drama, Crime"
      ],
      de: [
        "* Das Leben der Anderen (The Lives of Others) (2006) - A Stasi agent becomes invested in the lives of those he surveils, similar to 'The Conversation' in surveillance themes. | Genres: Drama, Thriller",
        "* Lola rennt (Run Lola Run) (1998) - A woman has 20 minutes to save her boyfriend, with a structure similar to 'Groundhog Day'. | Genres: Thriller, Action"
      ],
      es: [
        "* El laberinto del fauno (Pan's Labyrinth) (2006) - A dark fantasy paralleling war reality, similar to 'Bridge to Terabithia' in blending fantasy and harsh reality. | Genres: Fantasy, Drama, War",
        "* Todo sobre mi madre (All About My Mother) (1999) - A mother's journey after losing her son, exploring themes like 'Terms of Endearment'. | Genres: Drama"
      ],
      ur: [
        "* خوبصورت (Khubsoorat) (2014) - A free spirit changes a royal household's rigid ways, similar to 'The Sound of Music' in themes. | Genres: Comedy, Romance",
        "* بول (Bol) (2011) - A powerful examination of gender and society, sharing themes with 'Water'. | Genres: Drama"
      ]
    };

    const relevantPlotExamples = options.plotPreference ? 
      Object.entries(plotExamples)
        .find(([theme]) => options.plotPreference?.toLowerCase().includes(theme.toLowerCase()))?.[1] 
      : [];

    const selectedLanguageExamples = options.languages
      .map(lang => languageExamples[lang as keyof typeof languageExamples])
      .filter(Boolean)
      .flat();

    const examples = relevantPlotExamples ? 
      [...relevantPlotExamples, ...selectedLanguageExamples] : 
      selectedLanguageExamples;

    const prompt = `You are an expert film curator with deep knowledge of global cinema. Provide EXACTLY 5 movie recommendations that match the user's preferences, with special emphasis on plot and thematic elements.

**User Preferences (In Priority Order):**
${options.plotPreference ? `1. PLOT ELEMENTS (HIGHEST PRIORITY): "${options.plotPreference}"
   - MUST find movies where this plot element is central to the story
   - Prioritize EXACT matches where the plot element is the main focus
   - If no exact matches, find CLOSE matches where the plot element is significant
   - Consider both literal and thematic similarities
   - Explain why each movie matches the plot preference (EXACT MATCH or CLOSE MATCH)` : ''}
2. LANGUAGES: ${options.languages.join(', ')}
   - Movies MUST be originally made in these languages
   - Include both original title and English translation
3. GENRES: ${options.genres.join(', ')}
${options.similarMovies?.length ? `4. SIMILAR TO: ${options.similarMovies.join(', ')}
   - Consider plot structure, themes, tone, and style` : ''}
${options.preferredYear ? `5. PREFERRED YEAR: ${options.preferredYear}
   - Consider movies within ±5 years if exact matches aren't found` : ''}
${options.preferredCast?.length ? `6. NOTABLE CAST/CREW: ${options.preferredCast.join(', ')}` : ''}
${options.minImdbRating ? `7. MINIMUM RATING: ${options.minImdbRating}` : ''}
8. MATURE CONTENT: ${options.allowAdult ? 'Allowed' : 'Excluded'}

**STRICT FORMAT RULES:**
1. Each recommendation MUST follow this EXACT format:
   * [Original Title] ([English Title if different]) ([Year]) - [Plot + Similarity Explanation] | Genres: [Genre1, Genre2, ...]

2. Plot Description Requirements:
   - First sentence: Summarize the main plot
   - Second sentence: Explain why it matches user preferences
   - For plot preferences, explicitly state if it's an EXACT MATCH or CLOSE MATCH
   - If similar to a well-known movie, include comparison
   - Example: "EXACT MATCH for revenge theme - the entire plot revolves around revenge"

3. Title Format:
   - Start with "* " (asterisk and space)
   - Original title in native script
   - English title in parentheses
   - Year in parentheses
   - Hyphen
   - Two-sentence description
   - Pipe symbol
   - Genres (comma-separated)

**Examples of Correct Formatting:**
${examples.join('\n')}

**Critical Requirements:**
1. MUST provide EXACTLY 5 recommendations
2. ALL recommendations MUST be in the requested languages
3. ALL recommendations MUST be real, existing movies/shows
4. MUST prioritize plot/theme matching above all else
5. MUST explain similarities to user preferences
6. MUST follow the exact formatting shown in examples
7. MUST include both original and English titles for non-English content
8. MUST choose well-known, critically acclaimed movies when possible
9. MUST verify that the movies exist in TMDB before recommending
10. MUST ensure the movies match the requested genres
11. MUST explicitly state if a movie is an EXACT MATCH or CLOSE MATCH for plot preferences
12. MUST prioritize EXACT matches over CLOSE matches when both are available

Begin your recommendations now, following these formats exactly:`;

    return prompt;
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
    const options = buildMoviePreferences(data);

    try {
      const aiService = new AIService();
      const recommendations = await aiService.getRecommendations(options);

      if (!recommendations?.results || recommendations.results.length === 0) {
        return NextResponse.json(
          { error: 'No movies found that match your criteria. Please try different preferences.' },
          { status: 404 }
        );
      }

      // Sort recommendations based on title similarity to user query
      if (data.query) {
        const userQuery = data.query.toLowerCase();
        recommendations.results.sort((a, b) => 
          levenshteinDistance(a.title.toLowerCase(), userQuery) - 
          levenshteinDistance(b.title.toLowerCase(), userQuery)
        );
      }

      return NextResponse.json(recommendations);
    } catch (error) {
      console.error('Error processing recommendations:', error);
      return NextResponse.json(
        { error: 'Failed to get movie recommendations. Please try again with different preferences.' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
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

export { AIService };

