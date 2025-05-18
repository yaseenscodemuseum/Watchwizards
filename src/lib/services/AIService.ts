import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import axios from 'axios';

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const huggingface = axios.create({
  baseURL: 'https://api-inference.huggingface.co/models',
  headers: {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
  }
});

export interface MoviePreference {
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
}

export class AIService {
  async getRecommendations(options: MoviePreference, customPrompt?: string): Promise<{ results: MovieDetails[] }> {
    try {
      const prompt = customPrompt || this.getAIPrompt(options);
      
      // Try Gemini first
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Process the response and return movie details
        // ... (rest of the implementation)
        
        return { results: [] }; // Placeholder
      } catch (error) {
        console.error('Gemini error:', error);
        
        // Fallback to OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });
        
        // Process the response and return movie details
        // ... (rest of the implementation)
        
        return { results: [] }; // Placeholder
      }
    } catch (error) {
      console.error('AI service error:', error);
      throw new Error('Failed to get recommendations');
    }
  }

  private getAIPrompt(options: MoviePreference) {
    // ... (implementation of getAIPrompt)
    return ''; // Placeholder
  }
} 