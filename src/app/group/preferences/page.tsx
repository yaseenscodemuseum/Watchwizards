'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PreferencesData {
  contentType: string[];
  languages: string[];
  genres: string[];
  plotPreference: string;
  similarMovies: string;
  preferredYear: string;
  cast: string;
  rating: string;
  mature: boolean;
}

interface GroupSession {
  key: string;
  members: {
    id: string;
    username: string;
  }[];
  status: 'waiting' | 'preferences' | 'voting' | 'completed';
  settings: {
    maxMembers: number;
    numRecommendations: number;
    formTimer: number;
  };
}

export default function GroupPreferencesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupKey = searchParams.get('key');
  const userId = searchParams.get('userId');
  const username = searchParams.get('username');

  const [session, setSession] = useState<GroupSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes default
  const [preferredYear, setPreferredYear] = useState<string>('');
  const [filledFields, setFilledFields] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!groupKey || !userId || !username) {
      setError('Missing required parameters');
      setIsLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/group?key=${groupKey}`);
        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }
        const data = await response.json();
        setSession(data);
        if (data.settings?.formTimer) {
          setTimeLeft(data.settings.formTimer);
        }
      } catch (error) {
        setError('Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [groupKey, userId, username]);

  useEffect(() => {
    if (timeLeft <= 0) {
      // Redirect to voting page when time is up
      router.push(`/group/voting?key=${groupKey}&userId=${userId}&username=${username}`);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, groupKey, userId, username, router]);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{0,4}(-\d{0,4})?$/.test(value)) {
      setPreferredYear(value);
    } else if (value === '') {
      setPreferredYear('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    
    const preferences: PreferencesData = {
      contentType: Array.from(formData.getAll('contentType')).map(value => String(value)),
      languages: Array.from(formData.getAll('language')).map(value => String(value)),
      genres: Array.from(formData.getAll('genre')).map(value => String(value)),
      plotPreference: String(formData.get('plot') || ''),
      similarMovies: String(formData.get('similarMovies') || ''),
      preferredYear: preferredYear,
      cast: String(formData.get('cast') || ''),
      rating: String(formData.get('rating') || ''),
      mature: formData.get('mature') === 'on'
    };

    try {
      const response = await fetch('/api/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updatePreferences',
          key: groupKey,
          userId,
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Redirect to voting page after successful submission
      router.push(`/group/voting?key=${groupKey}&userId=${userId}&username=${username}`);
    } catch (error) {
      setError('Failed to submit preferences');
      setIsSubmitting(false);
    }
  };

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    
    const preferences: PreferencesData = {
      contentType: Array.from(formData.getAll('contentType')).map(value => String(value)),
      languages: Array.from(formData.getAll('language')).map(value => String(value)),
      genres: Array.from(formData.getAll('genre')).map(value => String(value)),
      plotPreference: String(formData.get('plot') || ''),
      similarMovies: String(formData.get('similarMovies') || ''),
      preferredYear: preferredYear,
      cast: String(formData.get('cast') || ''),
      rating: String(formData.get('rating') || ''),
      mature: formData.get('mature') === 'on'
    };
    
    setFilledFields(countFilledFields(preferences));
  };

  const countFilledFields = (preferences: PreferencesData): number => {
    let count = 0;
    if (preferences.contentType.length > 0) count++;
    if (preferences.languages.length > 0) count++;
    if (preferences.genres.length > 0) count++;
    if (preferences.plotPreference) count++;
    if (preferences.similarMovies) count++;
    if (preferences.preferredYear) count++;
    if (preferences.cast) count++;
    if (preferences.rating) count++;
    if (preferences.mature) count++;
    return count;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden">
        <div className="stars"></div>
        <div className="selection-container">
          <motion.div
            className="loading-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="wizard-icon"
              animate={{
                y: [0, -20, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <i className="fa-solid fa-hat-wizard"></i>
            </motion.div>
            <p className="loading-text">Loading preferences form...</p>
          </motion.div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden">
        <div className="stars"></div>
        <div className="selection-container">
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
          <Link href="/group" className="back-button">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              &lt; Back to Group Mode
            </motion.span>
          </Link>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden">
        <div className="stars"></div>
        <div className="selection-container">
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Session not found
          </motion.div>
          <Link href="/group" className="back-button">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              &lt; Back to Group Mode
            </motion.span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden">
      <div className="stars"></div>

      {/* Back Button */}
      <Link href="/group" className="back-button">
        <motion.span
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          &lt; Back to Group Mode
        </motion.span>
      </Link>

      {/* Main content */}
      <div className="selection-container">
        <motion.h2 
          className="selection-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Group Movie Preferences
        </motion.h2>

        <div className="session-info">
          <p>Time remaining: {formatTime(timeLeft)}</p>
          <p>Members in session: {session.members.length}/{session.settings.maxMembers}</p>
        </div>

        <motion.div
          className="solo-form-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <form onSubmit={handleSubmit} onChange={handleFormChange}>
            <div className="form-group">
              <label>Content Type</label>
              <div className="content-type-options">
                <label className="content-type-option">
                  <input type="checkbox" name="contentType" value="indie" />
                  <span>Indie Films</span>
                </label>
                <label className="content-type-option">
                  <input type="checkbox" name="contentType" value="movie" />
                  <span>Movie</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="language">Language (Optional)</label>
              <div className="language-options">
                <label className="language-option">
                  <input type="checkbox" name="language" value="de" />
                  <span>German</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="en" />
                  <span>English</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="es" />
                  <span>Spanish</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="fr" />
                  <span>French</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="hi" />
                  <span>Hindi</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="ja" />
                  <span>Japanese</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="ko" />
                  <span>Korean</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="language" value="ur" />
                  <span>Urdu</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="genre">Genre</label>
              <div className="language-options">
                <label className="language-option">
                  <input type="checkbox" name="genre" value="action" />
                  <span>Action</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="adventure" />
                  <span>Adventure</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="animation" />
                  <span>Animation</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="comedy" />
                  <span>Comedy</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="drama" />
                  <span>Drama</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="horror" />
                  <span>Horror</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="mystery" />
                  <span>Mystery</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="romance" />
                  <span>Romance</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="sci-fi" />
                  <span>Sci-Fi</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="supernatural" />
                  <span>Supernatural</span>
                </label>
                <label className="language-option">
                  <input type="checkbox" name="genre" value="thriller" />
                  <span>Thriller</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="plot">Plot Preferences (Optional)</label>
              <textarea 
                id="plot" 
                name="plot"
                placeholder="Describe what kind of story you're looking for..."
              ></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="similarMovies">Similar Movies (Optional)</label>
              <input 
                type="text" 
                id="similarMovies" 
                name="similarMovies"
                placeholder="Movies you've enjoyed..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="preferredYear">Preferred Year (Optional):</label>
              <input 
                type="text" 
                id="preferredYear" 
                name="preferredYear"
                value={preferredYear}
                onChange={handleYearChange}
                placeholder="e.g., 2011 or 2009-2011"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cast">Preferred Cast (Optional)</label>
              <input 
                type="text" 
                id="cast" 
                name="cast"
                placeholder="Actors/Actresses you like..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="rating">Minimum IMDb Rating (Optional)</label>
              <input 
                type="number" 
                id="rating" 
                name="rating"
                min="0" 
                max="10" 
                step="0.1" 
                placeholder="e.g., 7.5"
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input type="checkbox" id="mature" name="mature" />
                <span>Include Mature Content (18+)</span>
              </label>
            </div>

            {filledFields < 4 && filledFields > 0 && (
              <motion.div
                className="warning-message"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <i className="fas fa-exclamation-triangle"></i>
                <p>For better recommendations, please fill in at least 4 fields. Currently filled: {filledFields}/9</p>
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="submit-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isSubmitting || filledFields === 0}
            >
              {isSubmitting ? (
                <div className="loading-spinner">
                  <i className="fas fa-spinner fa-spin"></i>
                </div>
              ) : (
                'Submit Preferences'
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>

      {/* Magical sparkles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sparkles"></div>
      </div>
    </main>
  );
} 