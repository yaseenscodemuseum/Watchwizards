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

    // Create a more specific prompt for different recommendations
    const differentPrompt = `You are an expert film curator. I want recommendations that are different from these movies:

${currentRecommendations.map((movie: any, index: number) => 
  `${index + 1}. ${movie.title} (${movie.releaseDate?.split('-')[0] || 'N/A'}) - ${movie.overview}`
).join('\n')}

Please recommend 5 DIFFERENT movies that:
1. Offer a fresh perspective or unique take on the genres
2. Maintain similar quality but explore different themes or styles
3. Could appeal to someone who enjoys the above movies but wants something new
4. Are NOT the same movies as listed above or very similar ones
5. Still match the original preferences:
   - Languages: ${(preferences.languages || []).join(', ') || 'Any'}
   - Genres: ${(preferences.genres || []).join(', ') || 'Any'}
   ${preferences.plotPreference ? `- Plot elements: ${preferences.plotPreference}` : ''}
   ${preferences.preferredYear ? `- Preferred year: ${preferences.preferredYear}` : ''}

Format each recommendation exactly as:
* Movie Title (Year) - Brief description explaining how it offers a fresh perspective while still being appealing to fans of the above movies. | Genres: Genre1, Genre2`;

    // Update the preferences to exclude the current movies
    const updatedPreferences = {
      ...preferences,
      excludeMovies: currentRecommendations.map((movie: any) => movie.title).join(', '),
      similarityMode: 'different'
    };

    const aiService = new AIService();
    const recommendations = await aiService.getRecommendations(updatedPreferences, differentPrompt);

    if (!recommendations?.results?.length) {
      return NextResponse.json(
        { error: 'No different movies found. Please try different preferences.' },
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