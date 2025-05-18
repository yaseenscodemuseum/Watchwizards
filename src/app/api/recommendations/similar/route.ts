import { NextResponse } from 'next/server';
import { AIService } from '../route';

interface MoviePreference {
  languages: string[];
  genres: string[];
  plotPreference?: string;
  preferredYear?: string;
  [key: string]: any;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { currentRecommendations, preferences = {} as MoviePreference } = data;

    if (!currentRecommendations?.length) {
      return NextResponse.json(
        { error: 'No current recommendations provided' },
        { status: 400 }
      );
    }

    // Create a more specific prompt for similar recommendations
    const similarPrompt = `You are an expert film curator. I want recommendations similar to these movies:

${currentRecommendations.map((movie: any, index: number) => 
  `${index + 1}. ${movie.title} (${movie.releaseDate?.split('-')[0] || 'N/A'}) - ${movie.overview}`
).join('\n')}

Please recommend 5 DIFFERENT movies that:
1. Share similar themes, atmosphere, or storytelling style with the above movies
2. Are from the same genres or blend of genres
3. Have similar critical reception
4. Are NOT the same movies as listed above
5. Match the original preferences:
   - Languages: ${(preferences.languages || []).join(', ') || 'Any'}
   - Genres: ${(preferences.genres || []).join(', ') || 'Any'}
   ${preferences.plotPreference ? `- Plot elements: ${preferences.plotPreference}` : ''}
   ${preferences.preferredYear ? `- Preferred year: ${preferences.preferredYear}` : ''}

Format each recommendation exactly as:
* Movie Title (Year) - Brief description explaining why it's similar to the above movies and how it matches the themes/style. | Genres: Genre1, Genre2`;

    // Update the preferences to include the similar movies
    const updatedPreferences = {
      ...preferences,
      similarMovies: currentRecommendations.map((movie: any) => movie.title).join(', '),
      similarityMode: 'similar'
    };

    const aiService = new AIService();
    const recommendations = await aiService.getRecommendations(updatedPreferences, similarPrompt);

    if (!recommendations?.results?.length) {
      return NextResponse.json(
        { error: 'No similar movies found. Please try different preferences.' },
        { status: 404 }
      );
    }

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
} 