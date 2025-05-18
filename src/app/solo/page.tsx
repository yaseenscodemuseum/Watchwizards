'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

interface Recommendation {
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
}

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

const wizardIcons = [
  'fa-solid fa-hat-wizard',
  'fa-solid fa-wand-magic-sparkles',
  'fa-solid fa-wand-sparkles'
];

const loadingPhrases = [
  'Brewing your recommendations...',
  'Summoning your otherworldly recommendations...',
  'Searching the past for a movie to cast...',
  'Consulting the ancient scrolls...',
  'Gathering magical ingredients...',
  'Casting the perfect spell...',
  'Channeling the power of cinema...',
  'Unfolding the mysteries of entertainment...'
];

export default function SoloPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentIcon, setCurrentIcon] = useState(wizardIcons[0]);
  const [currentPhrase, setCurrentPhrase] = useState(loadingPhrases[0]);
  const [filledFields, setFilledFields] = useState<number>(0);
  const [preferredYear, setPreferredYear] = useState<string>('');
  const usedPhrasesRef = useRef<string[]>([]); // Track used phrases
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [plotPreference, setPlotPreference] = useState<string>('');
  const [similarMovies, setSimilarMovies] = useState<string>('');
  const [preferredCast, setPreferredCast] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [lastFormData, setLastFormData] = useState<PreferencesData | null>(null);

  useEffect(() => {
    if (isLoading) {
      const iconInterval = setInterval(() => {
        setCurrentIcon(wizardIcons[Math.floor(Math.random() * wizardIcons.length)]);
      }, 2000);

      const phraseInterval = setInterval(() => {
        setCurrentPhrase(getNextLoadingPhrase()); // Use the new function to get phrases
      }, 3000);

      return () => {
        clearInterval(iconInterval);
        clearInterval(phraseInterval);
      };
    }
  }, [isLoading]);

  const getNextLoadingPhrase = () => {
    const unusedPhrases = loadingPhrases.filter(phrase => !usedPhrasesRef.current.includes(phrase));
    if (unusedPhrases.length === 0) {
      usedPhrasesRef.current = []; // Reset if all phrases have been used
    }
    const nextPhrase = unusedPhrases[Math.floor(Math.random() * unusedPhrases.length)];
    usedPhrasesRef.current.push(nextPhrase);
    return nextPhrase;
  };

  // Function to validate year input format
  const validateYearInput = (yearInput: string): boolean => {
    // Check for single year format (YYYY)
    if (/^\d{4}$/.test(yearInput)) {
      const year = parseInt(yearInput);
      return year >= 1900 && year <= new Date().getFullYear();
    }
    
    // Check for year range format (YYYY-YYYY)
    if (/^\d{4}-\d{4}$/.test(yearInput)) {
      const [startYear, endYear] = yearInput.split('-').map(Number);
      const currentYear = new Date().getFullYear();
      return startYear >= 1900 && startYear <= currentYear && 
             endYear >= 1900 && endYear <= currentYear;
    }
    
    return false;
  };

  const handleSimilarRecommendations = async () => {
    if (!recommendations.length || !lastFormData) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/recommendations/similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentRecommendations: recommendations,
          preferences: lastFormData  // Now passing structured preferences
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch similar recommendations');
      }

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Ensure we only get 5 recommendations
        setRecommendations(data.results.slice(0, 5));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      setError('Failed to get similar recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDifferentRecommendations = async () => {
    if (!recommendations.length || !lastFormData) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/recommendations/different', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentRecommendations: recommendations,
          preferences: lastFormData  // Now passing structured preferences
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch different recommendations');
      }

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Ensure we only get 5 recommendations
        setRecommendations(data.results.slice(0, 5));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      setError('Failed to get different recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsLoading(true);
    setError(null);
    setRecommendations([]);

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    
    // Create a structured preferences object with proper type casting
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

    // Store the preferences object
    setLastFormData(() => preferences);

    // Validate form has minimum required fields
    const filledFieldsCount = countFilledFields(preferences);
    if (filledFieldsCount < 1) {
      setError('Please fill at least one field to get recommendations');
      setIsSubmitting(false);
      setIsLoading(false);
      return;
    }

    try {
      // Validate required fields
      if (!preferences.contentType?.length) {
        throw new Error('Please select at least one content type');
      }
      if (!preferences.languages?.length) {
        throw new Error('Please select at least one language');
      }
      if (!preferences.genres?.length) {
        throw new Error('Please select at least one genre');
      }

      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || response.statusText || 'Failed to get recommendations');
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        throw new Error('No recommendations found. Please try different preferences.');
      }

      // Remove the duplicate setLastFormData call since we already set it earlier
      setRecommendations(data.results.slice(0, 5));
      setError(null);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError(error instanceof Error ? error.message : 'Failed to get recommendations. Please try again.');
      setRecommendations([]);
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
      // Reset loading UI
      setCurrentIcon(wizardIcons[0]);
      setCurrentPhrase(loadingPhrases[0]);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{0,4}(-\d{0,4})?$/.test(value)) {
      setPreferredYear(value);
    } else if (value === '') {
      setPreferredYear(''); // Ensure controlled input remains controlled
    }
  };

  const goToNextCard = () => {
    setCurrentCardIndex((prevIndex) => 
      prevIndex === recommendations.length - 1 ? 0 : prevIndex + 1
    );
  };

  const goToPreviousCard = () => {
    setCurrentCardIndex((prevIndex) => 
      prevIndex === 0 ? recommendations.length - 1 : prevIndex - 1
    );
  };

  const goToCard = (index: number) => {
    setCurrentCardIndex(index);
  };

  // Function to count filled fields
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

  // Update filled fields count when form changes
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

  return (
    <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden selection-page">
      {/* Magical particles/stars effect */}
      <div className="absolute inset-0 z-0">
        <div className="stars"></div>
      </div>

      {/* Back Button */}
      <Link href="/selection" className="back-button">
        <motion.span
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          &lt; Back
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
          Personal Recommendations
        </motion.h2>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              className="loading-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                <i className={currentIcon}></i>
              </motion.div>
              <motion.p
                className="loading-text"
                key={currentPhrase}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {currentPhrase}
              </motion.p>
            </motion.div>
          ) : !recommendations.length ? (
            <motion.div
              key="form"
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
                  disabled={isLoading || filledFields === 0}
                >
                  {isLoading ? (
                    <div className="loading-spinner">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  ) : (
                    'Get Recommendations'
                  )}
                </motion.button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="recommendations-container"
            >
              <div className="carousel-container">
                <div className="carousel-indicators">
                  {recommendations.map((_, index) => (
                    <button
                      key={`indicator-${index}`}
                      className={`carousel-indicator ${index === currentCardIndex ? 'active' : ''}`}
                      onClick={() => goToCard(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                
                <div className="carousel-wrapper">
                  <button 
                    className="carousel-button prev-button"
                    onClick={goToPreviousCard}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  
                  <div className="carousel-content">
                    {recommendations.map((rec, index) => {
                      // Calculate position relative to current card
                      const position = index - currentCardIndex;
                      const isActive = position === 0;
                      const isPrev = position === -1 || (currentCardIndex === 0 && index === recommendations.length - 1);
                      const isNext = position === 1 || (currentCardIndex === recommendations.length - 1 && index === 0);
                      
                      // Only render current, previous and next cards
                      if (!isActive && !isPrev && !isNext) return null;
                      
                      return (
                        <motion.div
                          key={`carousel-card-${index}`}
                          className={`recommendation-card ${isActive ? 'active' : isPrev ? 'prev' : 'next'}`}
                          style={{
                            x: isActive ? 0 : position * 250,
                            scale: isActive ? 1 : 0.8,
                            opacity: isActive ? 1 : 0.6,
                            zIndex: isActive ? 3 : 1
                          }}
                          transition={{ 
                            duration: 0.5,
                            ease: "easeInOut"
                          }}
                          onClick={() => {
                            if (isActive) {
                              // Open IMDB or TMDB link in a new tab
                              const url = rec.imdbUrl || rec.tmdbUrl;
                              if (url) window.open(url, '_blank');
                            } else {
                              // If clicking on a side card, make it active
                              goToCard(index);
                            }
                          }}
                        >
                          <div className="recommendation-image">
                            {rec.posterPath ? (
                              <img src={rec.posterPath} alt={rec.title} />
                            ) : (
                              <div className="no-poster">
                                <i className="fas fa-film"></i>
                                <p>No Poster Available</p>
                              </div>
                            )}
                          </div>
                          <div className="recommendation-content">
                            <h3 title={rec.title}>{rec.title}</h3>
                            <div className="recommendation-meta">
                              <span>
                                {rec.releaseDate ? new Date(rec.releaseDate).getFullYear() || 'N/A' : 'N/A'}
                              </span>
                              <span>•</span>
                              <span>⭐ {(rec.voteAverage || 0).toFixed(1)}</span>
                              {rec.director && (
                                <>
                                  <span>•</span>
                                  <span title={`Director: ${rec.director}`}>
                                    <i className="fas fa-video"></i> {rec.director.split(' ')[0]}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="recommendation-genres">
                              {(rec.genres || []).slice(0, 3).map((genre: string) => (
                                <span key={genre} className="genre-tag">{genre}</span>
                              ))}
                            </div>
                            <p className="recommendation-description" title={rec.overview}>
                              {rec.overview}
                            </p>
                            <div className="recommendation-links">
                              {rec.imdbUrl && (
                                <a 
                                  href={rec.imdbUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="movie-link imdb"
                                >
                                  IMDb
                                </a>
                              )}
                              {rec.tmdbUrl && (
                                <a 
                                  href={rec.tmdbUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="movie-link tmdb"
                                >
                                  TMDB
                                </a>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  <button 
                    className="carousel-button next-button"
                    onClick={goToNextCard}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
              
              <div className="recommendation-actions">
                <motion.button
                  onClick={handleSimilarRecommendations}
                  disabled={isLoading}
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isLoading ? (
                    <div className="loading-spinner">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  ) : (
                    'Similar Recommendations'
                  )}
                </motion.button>
                <motion.button
                  onClick={handleDifferentRecommendations}
                  disabled={isLoading}
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isLoading ? (
                    <div className="loading-spinner">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  ) : (
                    'Different Recommendations'
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {error}
          </motion.div>
        )}
      </div>

      {/* Magical sparkles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sparkles"></div>
      </div>
    </main>
  );
}