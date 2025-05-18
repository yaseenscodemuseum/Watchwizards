import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { MoviePreference } from "../models/MoviePreference";
import { MovieService, SearchFilters } from "./movies";

interface ApiQuery {
  tmdb: {
    media_type: string[];
    with_genres: string[];
    with_original_language?: string[];
    vote_average_gte?: string;
    include_adult: boolean;
    with_cast?: string[];
    query?: string;
    year?: string;
  };
  omdb: {
    type: string;
    genre: string[];
    language: string[];
    imdbRating?: string;
    actors?: string[];
    plot?: string;
    year?: string;
  };
}

interface AIOptions {
  mediaType: string[];
  languages: string[];
  genres: string[];
  plotPreference: string;
  similarMovies: string[];
  preferredYear: string;
  preferredCast: string[];
  minImdbRating: number;
  allowAdult: boolean;
}

export class AIService {
  private gemini!: GoogleGenerativeAI;
  private openai!: OpenAI;
  private huggingfaceKey!: string;
  private deepseekKey!: string;
  private movieService: MovieService;
  
  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseekKey = process.env.DEEPSEEK_API_KEY;
    }
    if (process.env.HUGGINGFACE_API_KEY) {
      this.huggingfaceKey = process.env.HUGGINGFACE_API_KEY;
    }
    this.movieService = new MovieService();
  }

  public async generateApiQuery(preferences: MoviePreference): Promise<ApiQuery> {
    try {
      return await this.tryAIServices(preferences);
    } catch (error) {
      console.error('All AI services failed:', error);
      return this.fallbackQueryGeneration(preferences);
    }
  }

  private async tryAIServices(preferences: MoviePreference): Promise<ApiQuery> {
    try {
      // Try Gemini first as it's our preferred model
      if (this.gemini) {
        try {
          return await this.geminiGenerateQuery(preferences);
        } catch (error) {
          console.warn('Gemini failed:', error);
        }
      }

      // First fallback: OpenAI
      if (this.openai) {
        try {
          return await this.o3MiniGenerateQuery(preferences);
        } catch (error) {
          console.warn('OpenAI failed:', error);
        }
      }

      // Second fallback: DeepSeek
      if (this.deepseekKey) {
        try {
          return await this.deepseekGenerateQuery(preferences);
        } catch (error) {
          console.warn('DeepSeek failed:', error);
        }
      }

      // Last resort: Hugging Face
      if (this.huggingfaceKey) {
        return await this.huggingFaceGenerateQuery(preferences);
      }

      throw new Error('No AI services available');
    } catch (error) {
      console.error('All AI services failed:', error);
      throw error;
    }
  }

  private async geminiGenerateQuery(preferences: MoviePreference): Promise<ApiQuery> {
    if (!this.gemini) throw new Error('Gemini API not initialized');
    
    const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = this.buildAIPrompt(preferences);
    
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      // Attempt to parse as JSON to validate format
      JSON.parse(text);
      return this.parseAIResponse(text, preferences);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  private async o3MiniGenerateQuery(preferences: MoviePreference): Promise<ApiQuery> {
    if (!this.openai) throw new Error('OpenAI API not initialized');
    
    const prompt = this.buildAIPrompt(preferences);
    
    const completion = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a movie search expert. Return a JSON object with tmdb and omdb search parameters." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return this.parseAIResponse(completion.choices[0].message.content || '', preferences);
  }

  private async deepseekGenerateQuery(preferences: MoviePreference): Promise<ApiQuery> {
    if (!this.deepseekKey) throw new Error('DeepSeek API not initialized');
    
    const prompt = this.buildAIPrompt(preferences);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.deepseekKey}`,
        'HTTP-Referer': 'https://watchwizards.vercel.app',
        'X-Title': 'WatchWizards',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-zero:free",
        messages: [
          {
            role: "system",
            content: "You are a movie search expert. Return a JSON object with tmdb and omdb search parameters."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('DeepSeek API error:', error);
      throw new Error(`DeepSeek API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return this.parseAIResponse(data.choices[0].message.content, preferences);
  }

  private async huggingFaceGenerateQuery(preferences: MoviePreference): Promise<ApiQuery> {
    if (!this.huggingfaceKey) throw new Error('Hugging Face API not initialized');
    
    const prompt = this.buildAIPrompt(preferences);
    
    const response = await fetch('https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.huggingfaceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: 0.7,
          max_length: 500,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('Hugging Face API error:', error);
      throw new Error(`Hugging Face API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return this.parseAIResponse(Array.isArray(data) ? data[0].generated_text : data.generated_text, preferences);
  }

  private buildAIPrompt(preferences: MoviePreference): string {
    const {
      mediaType = [],
      languages = [],
      genres = [],
      plotPreference,
      similarMovies = [],
      preferredYear,
      preferredCast = [],
      minImdbRating,
      allowAdult = false
    } = preferences;

    // Build base prompt
    let prompt = `Based on the user's preferences, recommend 5 ${mediaType.includes('webseries') ? 'web series' : 'movies'} `;

    // Add language preferences
    if (languages.length > 0) {
      prompt += `in ${languages.join(' or ')} `;
    }

    // Add genre preferences
    if (genres.length > 0) {
      prompt += `in the ${genres.join(' and ')} genre${genres.length > 1 ? 's' : ''} `;
    }

    // Add plot preferences
    if (plotPreference) {
      prompt += `that involve ${plotPreference} `;
    }

    // Add year preference
    if (preferredYear) {
      prompt += `from around ${preferredYear} `;
    }

    // Add cast preferences
    if (preferredCast.length > 0) {
      prompt += `starring ${preferredCast.join(' or ')} `;
    }

    // Add rating requirement
    if (minImdbRating) {
      prompt += `with an IMDb rating of at least ${minImdbRating} `;
    }

    // Add content filter
    if (!allowAdult) {
      prompt += 'excluding adult content ';
    }

    prompt += `\n\nProvide EXACTLY 5 recommendations in this EXACT format (including asterisks, parentheses, and pipe symbol):

*Movie Title* (Year) - Plot description | Genres: Genre1, Genre2

Requirements:
1. Use EXACT movie titles as released for the language
2. Include EXACT release year
3. Keep descriptions concise but informative
4. List relevant genres after the pipe symbol
5. Format MUST match example exactly

`;

    // Add specific instructions for web series if needed
    if (mediaType.includes('webseries')) {
      prompt += `\nFor web series, use: *Title* (StartYear-EndYear) or *Title* (StartYear-present) for ongoing series.`;
    }

    return prompt;
  }

  private parseAIResponse(response: string, preferences: MoviePreference): ApiQuery {
    try {
      // First try to parse as JSON
      try {
        const jsonResponse = JSON.parse(response);
        return this.validateApiQuery(jsonResponse);
      } catch (e) {
        // Not JSON, continue with text parsing
      }

      // Extract movie recommendations from text response
      const movieRegex = /\d+\.\s+(.*?)\s+\(\d{4}\)/g;
      const matches = [...response.matchAll(movieRegex)];
      
      // Build search query based on extracted movies and preferences
      const query: ApiQuery = {
        tmdb: {
          media_type: preferences.mediaType as string[],
          with_genres: preferences.genres?.map(genre => this.getGenreId(genre).toString()) || [],
          with_original_language: preferences.languages?.map(lang => this.getLanguageCode(lang)) || [],
          vote_average_gte: preferences.minImdbRating?.toString() || "0",
          include_adult: preferences.allowAdult || false,
          with_cast: preferences.preferredCast || [],
          query: matches.length > 0 
            ? matches.map(m => m[1]).join(' OR ') 
            : preferences.plotPreference || ''
        },
        omdb: {
          type: preferences.mediaType?.includes('movie') ? 'movie' : 'series',
          genre: preferences.genres || [],
          language: preferences.languages || [],
          imdbRating: preferences.minImdbRating?.toString(),
          actors: preferences.preferredCast || [],
          plot: preferences.plotPreference || ''
        }
      };

      if (preferences.preferredYear) {
        query.tmdb.year = preferences.preferredYear;
        query.omdb.year = preferences.preferredYear;
      }

      return this.validateApiQuery(query);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.fallbackQueryGeneration(preferences);
    }
  }

  private validateApiQuery(query: any): ApiQuery {
    // Ensure all properties are of the correct type
    const validatedQuery: ApiQuery = {
      tmdb: {
        media_type: Array.isArray(query.tmdb?.media_type) ? query.tmdb.media_type : ['movie'],
        with_genres: Array.isArray(query.tmdb?.with_genres) ? query.tmdb.with_genres.map(String) : [],
        with_original_language: Array.isArray(query.tmdb?.with_original_language) 
          ? query.tmdb.with_original_language.map(String) 
          : undefined,
        vote_average_gte: query.tmdb?.vote_average_gte?.toString() || undefined,
        include_adult: Boolean(query.tmdb?.include_adult),
        with_cast: Array.isArray(query.tmdb?.with_cast) ? query.tmdb.with_cast.map(String) : undefined,
        query: query.tmdb?.query?.toString() || undefined,
        year: query.tmdb.year || undefined
      },
      omdb: {
        type: typeof query.omdb?.type === 'string' ? query.omdb.type : 'movie',
        genre: Array.isArray(query.omdb?.genre) ? query.omdb.genre : [],
        language: Array.isArray(query.omdb?.language) ? query.omdb.language : [],
        imdbRating: query.omdb?.imdbRating?.toString() || undefined,
        actors: Array.isArray(query.omdb?.actors) ? query.omdb.actors : undefined,
        plot: typeof query.omdb?.plot === 'string' ? query.omdb.plot : undefined,
        year: query.omdb.year || undefined
      }
    };
    
    return validatedQuery;
  }

  private getGenreId(genreName: string): number {
    const genreMap: Record<string, number> = {
      'action': 28,
      'adventure': 12,
      'animation': 16,
      'comedy': 35,
      'crime': 80,
      'documentary': 99,
      'drama': 18,
      'family': 10751,
      'fantasy': 14,
      'history': 36,
      'horror': 27,
      'music': 10402,
      'mystery': 9648,
      'romance': 10749,
      'science fiction': 878,
      'sci-fi': 878,
      'thriller': 53,
      'war': 10752,
      'western': 37
    };
    return genreMap[genreName.toLowerCase()] || 0;
  }

  private getLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      'english': 'en',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'japanese': 'ja',
      'korean': 'ko',
      'chinese': 'zh',
      'hindi': 'hi',
      'portuguese': 'pt',
      'russian': 'ru',
      'arabic': 'ar',
      'turkish': 'tr'
    };
    return languageMap[language.toLowerCase()] || language.toLowerCase();
  }

  private validateTMDBQuery(query: any): ApiQuery['tmdb'] {
    return {
      media_type: Array.isArray(query.media_type) ? query.media_type : [query.media_type || 'movie'],
      with_genres: Array.isArray(query.with_genres) ? query.with_genres : [],
      with_original_language: Array.isArray(query.with_original_language) ? query.with_original_language : undefined,
      vote_average_gte: typeof query.vote_average_gte === 'string' ? query.vote_average_gte : undefined,
      include_adult: Boolean(query.include_adult),
      with_cast: Array.isArray(query.with_cast) ? query.with_cast : undefined,
      query: typeof query.query === 'string' ? query.query : undefined,
      year: query.year || undefined
    };
  }

  private validateOMDBQuery(query: any): ApiQuery['omdb'] {
    return {
      type: query.type || 'movie',
      genre: Array.isArray(query.genre) ? query.genre : [],
      language: Array.isArray(query.language) ? query.language : undefined,
      imdbRating: query.imdbRating?.toString(),
      actors: Array.isArray(query.actors) ? query.actors : undefined,
      plot: typeof query.plot === 'string' ? query.plot : undefined,
      year: query.year || undefined
    };
  }

  private fallbackQueryGeneration(preferences: MoviePreference): ApiQuery {
    console.log('Using fallback query generation');
    const query: ApiQuery = {
      tmdb: {
        media_type: Array.isArray(preferences.mediaType) ? preferences.mediaType : ['movie'],
        with_genres: preferences.genres?.map(genre => this.getGenreId(genre).toString()) || [],
        with_original_language: preferences.languages?.map(lang => this.getLanguageCode(lang)) || [],
        vote_average_gte: preferences.minImdbRating?.toString() || "0",
        include_adult: preferences.allowAdult || false,
        with_cast: preferences.preferredCast || [],
        query: preferences.plotPreference || undefined
      },
      omdb: {
        type: preferences.mediaType?.includes('movie') ? 'movie' : 'series',
        genre: preferences.genres || [],
        language: preferences.languages || [],
        imdbRating: preferences.minImdbRating?.toString(),
        actors: preferences.preferredCast || [],
        plot: preferences.plotPreference || undefined
      }
    };

    if (preferences.preferredYear) {
      query.tmdb.year = preferences.preferredYear;
      query.omdb.year = preferences.preferredYear;
    }

    return query;
  }

  public async getRecommendations(preferences: MoviePreference) {
    console.log("Processing preferences:", JSON.stringify(preferences, null, 2));
    const query = await this.generateApiQuery(preferences);
    console.log("Generated query:", JSON.stringify(query, null, 2));
    
    // Convert the API query to search filters
    const searchFilters: SearchFilters = {
      mediaTypes: query.tmdb.media_type,
      genres: query.tmdb.with_genres,
      languages: query.tmdb.with_original_language || [],
      minRating: query.tmdb.vote_average_gte ? parseFloat(query.tmdb.vote_average_gte) : undefined,
      includeAdult: query.tmdb.include_adult,
      cast: query.tmdb.with_cast || [],
      plot: query.tmdb.query || undefined,
      year: query.tmdb.year || preferences.preferredYear || undefined
    };
    
    console.log("Search filters:", JSON.stringify(searchFilters, null, 2));

    // Get results with strict filtering
    const results = await this.movieService.searchMovie(searchFilters);
    console.log(`Found ${results.results.length} movies matching all criteria`);
    return results;
  }
}
