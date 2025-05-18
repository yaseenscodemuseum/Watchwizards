'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SelectionPage() {
  const pathname = usePathname();

  return (
    <main className="h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden selection-page">
      {/* Magical particles/stars effect */}
      <div className="absolute inset-0 z-0">
        <div className="stars"></div>
      </div>

      {/* Title */}
      <motion.h1 
        className="font-redaction text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 fixed top-1rem left-0 right-0 text-center z-50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        WatchWizards
      </motion.h1>

      {/* Navigation */}
      <nav className="nav-container">
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
          Home
        </Link>
        <Link href="/popular" className={`nav-link ${pathname === '/popular' ? 'active' : ''}`}>
          Popular Right Now
        </Link>
        <Link href="/about" className={`nav-link ${pathname === '/about' ? 'active' : ''}`}>
          About Us
        </Link>
        <Link href="/contact" className={`nav-link ${pathname === '/contact' ? 'active' : ''}`}>
          Contact Us
        </Link>
      </nav>

      {/* Main content */}
      <div className="selection-container">
        <motion.h2 
          className="selection-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Choose Your Magical Journey
        </motion.h2>

        <div className="mode-buttons">
          <Link href="/solo">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mode-button"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <span>Personal Recommendations</span>
              <span>Find your perfect match</span>
            </motion.button>
          </Link>

          <Link href="/group">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mode-button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <span>Watch with Friends</span>
              <span>Group movie night</span>
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Magical sparkles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sparkles"></div>
      </div>
    </main>
  );
} 