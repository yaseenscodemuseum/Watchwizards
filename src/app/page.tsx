'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center relative overflow-hidden">
      {/* Logo */}
      <motion.a
        href="https://yaseensportfolio.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="logo-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <Image
          src="/background/logo.svg"
          alt="Logo"
          width={75}
          height={75}
          className="logo"
          priority
        />
      </motion.a>

      {/* Magical particles/stars effect */}
      <div className="absolute inset-0 z-0">
        <div className="stars"></div>
      </div>

      {/* Main content */}
      <div className="z-10 flex flex-col items-center justify-center gap-8">
        <motion.h1 
          className="font-redaction text-6xl md:text-8xl text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400"
        >
          WatchWizards
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="subtitle"
        >
          Summon the perfect movie for you
        </motion.p>

        <Link href="/selection">
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button"
          >
            Begin Your Magical Journey
          </motion.button>
        </Link>
      </div>

      {/* Magical sparkles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sparkles"></div>
      </div>
    </main>
  );
} 