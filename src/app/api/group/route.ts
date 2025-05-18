import { NextResponse } from 'next/server';
import { GroupSessionService } from '@/lib/services/groupSession';

const groupSessionService = GroupSessionService.getInstance();

export async function POST(request: Request) {
  try {
    const { action, key, userId, username, preferences, recommendationId } = await request.json();

    switch (action) {
      case 'create':
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }
        const session = await groupSessionService.createSession(userId);
        return NextResponse.json({ key: session.key });

      case 'join':
        if (!key || !userId || !username) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }
        const joinedSession = await groupSessionService.joinSession(key, userId, username);
        if (!joinedSession) {
          return NextResponse.json(
            { error: 'Session not found or is full' },
            { status: 404 }
          );
        }
        return NextResponse.json(joinedSession);

      case 'start':
        if (!key || !userId) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }
        const startedSession = await groupSessionService.startSession(key, userId);
        if (!startedSession) {
          return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }
        return NextResponse.json(startedSession);

      case 'updatePreferences':
        if (!key || !userId || !preferences) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }
        const updatedSession = await groupSessionService.updateMemberPreferences(key, userId, preferences);
        if (!updatedSession) {
          return NextResponse.json(
            { error: 'Session not found or user not in session' },
            { status: 404 }
          );
        }
        return NextResponse.json(updatedSession);

      case 'vote':
        if (!key || !userId || !recommendationId) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }
        const votedSession = await groupSessionService.vote(key, userId, recommendationId);
        if (!votedSession) {
          return NextResponse.json(
            { error: 'Session not found or recommendation not found' },
            { status: 404 }
          );
        }
        
        // After voting, get top recommendations
        const sessionWithTopRecommendations = await groupSessionService.getTopRecommendations(key);
        return NextResponse.json(sessionWithTopRecommendations);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Group session API error:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Missing session key' },
        { status: 400 }
      );
    }

    const session = await groupSessionService.getSession(key);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Group session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 