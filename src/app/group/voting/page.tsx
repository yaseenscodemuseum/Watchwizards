'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Recommendation {
  id: string;
  title: string;
  posterPath?: string;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  votes: number;
}

interface GroupSession {
  key: string;
  members: {
    id: string;
    username: string;
  }[];
  recommendations: Recommendation[];
  status: 'waiting' | 'preferences' | 'voting' | 'completed';
}

export default function VotingPage() {
  const searchParams = useSearchParams();
  const groupKey = searchParams.get('key');
  const userId = searchParams.get('userId');
  const username = searchParams.get('username');

  const [session, setSession] = useState<GroupSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes default

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
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleVote = async (recommendationId: string) => {
    if (!groupKey || !userId || hasVoted) return;

    try {
      const response = await fetch('/api/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'vote',
          key: groupKey,
          userId,
          recommendationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      const data = await response.json();
      setSession(data);
      setHasVoted(true);
    } catch (error) {
      setError('Failed to submit vote');
    }
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
            <p className="loading-text">Loading voting session...</p>
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

  // Sort recommendations by votes
  const sortedRecommendations = [...session.recommendations].sort((a, b) => b.votes - a.votes);

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
          Vote for Your Favorite Movie
        </motion.h2>

        <div className="voting-info">
          <p>Time remaining: {formatTime(timeLeft)}</p>
          <p>Members in session: {session.members.length}</p>
          {hasVoted && <p className="voted-message">You have voted!</p>}
        </div>

        <div className="recommendations-grid">
          {sortedRecommendations.map((recommendation, index) => (
            <motion.div
              key={recommendation.id}
              className="recommendation-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {recommendation.posterPath && (
                <img
                  src={`https://image.tmdb.org/t/p/w500${recommendation.posterPath}`}
                  alt={recommendation.title}
                  className="movie-poster"
                />
              )}
              <div className="movie-info">
                <h3>{recommendation.title}</h3>
                <p className="release-date">{recommendation.releaseDate}</p>
                <p className="overview">{recommendation.overview}</p>
                <div className="vote-count">
                  <span>Votes: {recommendation.votes}</span>
                  <span>Rating: {recommendation.voteAverage}/10</span>
                </div>
                {!hasVoted && (
                  <motion.button
                    className="vote-button"
                    onClick={() => handleVote(recommendation.id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Vote
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Magical sparkles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sparkles"></div>
      </div>
    </main>
  );
} 