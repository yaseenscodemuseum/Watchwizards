import mongoose from 'mongoose';

export interface GroupSession {
  key: string;
  createdAt: Date;
  expiresAt: Date;
  adminId: string;
  members: {
    id: string;
    username: string;
    isAdmin?: boolean;
    preferences?: {
      contentType: string[];
      languages: string[];
      genres: string[];
      plotPreference?: string;
      similarMovies?: string;
      preferredYear?: string;
      cast?: string;
      rating?: string;
      mature?: boolean;
    };
  }[];
  status: 'waiting' | 'preferences' | 'voting' | 'completed';
  recommendations?: {
    id: string;
    title: string;
    posterPath?: string;
    overview: string;
    releaseDate: string;
    voteAverage: number;
    votes: number;
    userId: string;
  }[];
  settings: {
    maxMembers: number;
    numRecommendations: number;
    formTimer: number;
  };
}

const groupSessionSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    minlength: 6,
    maxlength: 8
  },
  adminId: {
    type: String,
    required: true
  },
  createdAt: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    default: () => new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
  },
  members: [{
    id: { type: String, required: true },
    username: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    preferences: {
      contentType: [{ type: String }],
      languages: [{ type: String }],
      genres: [{ type: String }],
      plotPreference: { type: String },
      similarMovies: { type: String },
      preferredYear: { type: String },
      cast: { type: String },
      rating: { type: String },
      mature: { type: Boolean }
    }
  }],
  status: { 
    type: String, 
    enum: ['waiting', 'preferences', 'voting', 'completed'],
    default: 'waiting'
  },
  recommendations: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    posterPath: { type: String },
    overview: { type: String, required: true },
    releaseDate: { type: String, required: true },
    voteAverage: { type: Number, required: true },
    votes: { type: Number, default: 0 },
    userId: { type: String, required: true }
  }],
  settings: {
    maxMembers: { type: Number, default: 10 },
    numRecommendations: { type: Number, default: 5 },
    formTimer: { type: Number, default: 300 } // 5 minutes in seconds
  }
});

// Index for faster queries
groupSessionSchema.index({ key: 1 });
groupSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GroupSession = mongoose.models.GroupSession || mongoose.model('GroupSession', groupSessionSchema); 