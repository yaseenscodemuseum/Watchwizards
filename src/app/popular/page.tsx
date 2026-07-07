'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PopularItem {
  id: string;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  genres: string[];
  voteAverage: number;
  director: string;
  tmdbUrl: string;
  imdbUrl: string | null;
  mediaType: 'movie' | 'tv';
}

function PopularCard({ item, index }: { item: PopularItem; index: number }) {
  return (
    <motion.div
      className="recommendation-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.4 }}
    >
      <div className="recommendation-image">
        {item.posterPath ? (
          <img src={item.posterPath} alt={item.title} />
        ) : (
          <div className="no-poster">
            <i className={item.mediaType === 'tv' ? 'fas fa-tv' : 'fas fa-film'}></i>
            <span>No poster available</span>
          </div>
        )}
      </div>
      <div className="recommendation-content">
        <h3>{item.title}</h3>
        <div className="recommendation-meta">
          {item.releaseDate && <span>{item.releaseDate.split('-')[0]}</span>}
          <span>•</span>
          <span>⭐ {item.voteAverage.toFixed(1)}</span>
          {item.director && (
            <>
              <span>•</span>
              <span>
                <i className="fas fa-video"></i> {item.director.split(' ')[0]}
              </span>
            </>
          )}
        </div>
        {item.genres.length > 0 && (
          <div className="recommendation-genres">
            {item.genres.slice(0, 3).map(genre => (
              <span key={genre} className="genre-tag">{genre}</span>
            ))}
          </div>
        )}
        <p className="recommendation-description">{item.overview}</p>
        <div className="recommendation-links">
          {item.imdbUrl && (
            <a href={item.imdbUrl} target="_blank" rel="noopener noreferrer" className="movie-link imdb">
              IMDb
            </a>
          )}
          <a href={item.tmdbUrl} target="_blank" rel="noopener noreferrer" className="movie-link tmdb">
            TMDB
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export default function PopularPage() {
  const pathname = usePathname();
  const [movies, setMovies] = useState<PopularItem[]>([]);
  const [shows, setShows] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/popular')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch popular titles');
        return res.json();
      })
      .then(data => {
        setMovies(data.movies || []);
        setShows(data.shows || []);
      })
      .catch(() => setError('The magic fizzled — could not load popular titles. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden selection-page">
      {/* Title */}
      <div className="fixed top-8rem left-1rem right-0 flex items-center justify-center gap-4 z-50">
        <motion.a
          href="https://yaseensportfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer"
          whileHover={{ scale: 1.05 }}
        >
          <motion.h1
            className="font-redaction text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 text-6xl md:text-8xl"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            WatchWizards
          </motion.h1>
        </motion.a>
      </div>

      {/* Navigation */}
      <nav className="nav-container">
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
          Home
        </Link>
        <Link href="/popular" className={`nav-link ${pathname === '/popular' ? 'active' : ''}`}>
          Popular Right Now
        </Link>
        <a
          href="https://yaseensportfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link"
        >
          Contact Us
        </a>
      </nav>

      {/* Scrollable content */}
      <div className="popular-container">
        {loading ? (
          <div className="popular-loading">
            <motion.i
              className="fas fa-hat-wizard"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <p>Summoning what everyone is watching...</p>
          </div>
        ) : error ? (
          <div className="popular-loading">
            <p>{error}</p>
          </div>
        ) : (
          <>
            <section className="popular-section">
              <h2 className="selection-title">Popular Movies</h2>
              <div className="recommendations-grid">
                {movies.map((item, index) => (
                  <PopularCard key={item.id} item={item} index={index} />
                ))}
              </div>
            </section>

            <section className="popular-section">
              <h2 className="selection-title">Popular Shows</h2>
              <div className="recommendations-grid">
                {shows.map((item, index) => (
                  <PopularCard key={item.id} item={item} index={index} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Magical particles/stars effect */}
      <div className="absolute inset-0 z-0">
        <div className="stars"></div>
      </div>
    </main>
  );
}
