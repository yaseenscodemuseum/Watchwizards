import { GroupSession, GroupSession as IGroupSession } from '../models/GroupSession';
import { connectDB } from './db';
import { nanoid } from 'nanoid';

interface Recommendation {
  id: string;
  title: string;
  posterPath?: string;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  userId: string;
  votes: number;
}

export class GroupSessionService {
  private static instance: GroupSessionService;

  private constructor() {}

  public static getInstance(): GroupSessionService {
    if (!GroupSessionService.instance) {
      GroupSessionService.instance = new GroupSessionService();
    }
    return GroupSessionService.instance;
  }

  private async ensureConnection() {
    await connectDB();
  }

  async createSession(adminId: string, settings: {
    maxMembers?: number;
    numRecommendations?: number;
    formTimer?: number;
  } = {}): Promise<IGroupSession> {
    await this.ensureConnection();

    const key = nanoid(6).toUpperCase();

    const session = new GroupSession({
      key,
      adminId,
      settings: {
        maxMembers: settings.maxMembers || 10,
        numRecommendations: settings.numRecommendations || 5,
        formTimer: settings.formTimer || 300
      }
    });

    await session.save();
    return session;
  }

  async getSession(key: string): Promise<IGroupSession | null> {
    await this.ensureConnection();
    return GroupSession.findOne({ key });
  }

  async joinSession(key: string, userId: string, username: string): Promise<IGroupSession | null> {
    await this.ensureConnection();
    
    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    // Check if session is full
    if (session.members.length >= session.settings.maxMembers) {
      throw new Error('Session is full');
    }

    // Check if user is already a member
    if (session.members.some((member: { id: string }) => member.id === userId)) {
      return session;
    }

    // Add new member with admin status if they're the creator
    session.members.push({ 
      id: userId, 
      username,
      isAdmin: userId === session.adminId
    });
    await session.save();

    return session;
  }

  async updateMemberPreferences(
    key: string,
    userId: string,
    preferences: {
      contentType: string[];
      languages: string[];
      genres: string[];
      plotPreference?: string;
      similarMovies?: string;
      preferredYear?: string;
      cast?: string;
      rating?: string;
      mature?: boolean;
    }
  ): Promise<IGroupSession | null> {
    await this.ensureConnection();

    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    const memberIndex = session.members.findIndex((member: { id: string }) => member.id === userId);
    if (memberIndex === -1) return null;

    session.members[memberIndex].preferences = preferences;
    await session.save();

    return session;
  }

  async updateSessionStatus(key: string, status: 'waiting' | 'preferences' | 'voting' | 'completed'): Promise<IGroupSession | null> {
    await this.ensureConnection();

    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    session.status = status;
    await session.save();

    return session;
  }

  async addRecommendations(key: string, recommendations: {
    id: string;
    title: string;
    posterPath?: string;
    overview: string;
    releaseDate: string;
    voteAverage: number;
  }[]): Promise<IGroupSession | null> {
    await this.ensureConnection();

    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    session.recommendations = recommendations.map((rec: {
      id: string;
      title: string;
      posterPath?: string;
      overview: string;
      releaseDate: string;
      voteAverage: number;
    }) => ({
      ...rec,
      votes: 0
    }));
    await session.save();

    return session;
  }

  async vote(key: string, userId: string, recommendationId: string): Promise<IGroupSession | null> {
    await this.ensureConnection();

    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    const recommendation = session.recommendations?.find((rec: { id: string }) => rec.id === recommendationId);
    if (!recommendation) return null;

    // Increment votes
    recommendation.votes += 1;
    await session.save();

    return session;
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.ensureConnection();
    await GroupSession.deleteMany({ expiresAt: { $lt: new Date() } });
  }

  async startSession(key: string, userId: string): Promise<IGroupSession | null> {
    await this.ensureConnection();

    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    // Verify the user is the admin
    if (session.adminId !== userId) {
      throw new Error('Only the admin can start the session');
    }

    session.status = 'preferences';
    await session.save();

    return session;
  }

  async getTopRecommendations(key: string): Promise<IGroupSession | null> {
    await this.ensureConnection();

    const session = await GroupSession.findOne({ key });
    if (!session) return null;

    // Group recommendations by user and get top 2 for each
    const userRecommendations = session.recommendations?.reduce((acc: Record<string, Recommendation[]>, rec: Recommendation) => {
      if (!acc[rec.userId]) {
        acc[rec.userId] = [];
      }
      acc[rec.userId].push(rec);
      return acc;
    }, {});

    // Sort each user's recommendations by votes and take top 2
    const recommendationsArray = Object.values(userRecommendations || {}) as Recommendation[][];
    const topRecommendations = recommendationsArray.flatMap(userRecs => 
      userRecs.sort((a, b) => b.votes - a.votes).slice(0, 2)
    );

    session.recommendations = topRecommendations;
    await session.save();

    return session;
  }
} 