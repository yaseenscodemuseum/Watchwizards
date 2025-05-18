import mongoose from 'mongoose';

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
  languagePriority?: {
    code: string;
    priority: number;
  }[];
}

export const supportedLanguages = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  ur: 'Urdu'
} as const;

export type LanguageCode = keyof typeof supportedLanguages;

const moviePreferenceSchema = new mongoose.Schema({
  mediaType: [{ type: String, enum: ['anime', 'indie', 'movie', 'webseries'] }],
  languages: [{ type: String, enum: ['English', 'French', 'German', 'Hindi', 'Japanese', 'Korean', 'Spanish', 'Urdu'] }],
  genres: [{ type: String, enum: ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Supernatural', 'Thriller'] }],
  plotPreference: { type: String, required: false },
  similarMovies: [{ type: String }],
  preferredYear: { type: String, required: false },
  preferredCast: [{ type: String }],
  minImdbRating: { type: Number, min: 0, max: 10, required: false },
  allowAdult: { type: Boolean, default: false }
});

export const MoviePreference = mongoose.models.MoviePreference || mongoose.model('MoviePreference', moviePreferenceSchema);