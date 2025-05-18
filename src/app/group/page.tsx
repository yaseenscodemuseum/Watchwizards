'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function GroupPage() {
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
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h2 className="selection-title mb-8">Group Movie Night</h2>
          <div className="bg-gray-800/50 p-8 rounded-lg backdrop-blur-sm">
            <h3 className="text-2xl font-semibold mb-4">Coming Soon!</h3>
            <p className="text-gray-300 mb-6">
              We're working on bringing you an amazing group movie night experience.
              Stay tuned for updates!
            </p>
            <div className="text-sm text-gray-400">
              Features coming soon:
              <ul className="mt-2 space-y-2">
                <li>• Create and join group sessions</li>
                <li>• Share movie preferences with friends</li>
                <li>• Vote on group recommendations</li>
                <li>• Real-time group updates</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
} 