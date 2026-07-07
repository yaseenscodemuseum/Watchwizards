import { NextResponse } from 'next/server';
import { AIService, buildMoviePreferences } from './service';

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
