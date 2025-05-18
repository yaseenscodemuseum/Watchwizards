'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GroupMember {
  id: string;
  username: string;
  isAdmin: boolean;
}

export default function GroupPage() {
  const [groupKey, setGroupKey] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isInLobby, setIsInLobby] = useState<boolean>(false);
  const [userId] = useState<string>(() => Math.random().toString(36).substr(2, 9));
  const router = useRouter();

  // Add polling effect
  useEffect(() => {
    if (!isInLobby || !groupKey) return;

    const pollSession = async () => {
      try {
        const response = await fetch(`/api/group?key=${groupKey}`);
        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }
        const data = await response.json();
        setMembers(data.members);
      } catch (err) {
        console.error('Error polling session:', err);
      }
    };

    // Poll immediately and then every 3 seconds
    pollSession();
    const interval = setInterval(pollSession, 3000);

    return () => clearInterval(interval);
  }, [isInLobby, groupKey]);

  const handleCreateGroup = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          userId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create group');
      }

      const data = await response.json();
      const newGroupKey = data.key;

      // Join the session as the creator
      const joinResponse = await fetch('/api/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          key: newGroupKey,
          userId,
          username
        }),
      });

      if (!joinResponse.ok) {
        throw new Error('Failed to join created group');
      }

      const sessionData = await joinResponse.json();
      setGroupKey(newGroupKey);
      setMembers(sessionData.members);
      setIsInLobby(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!username.trim() || !groupKey.trim()) {
      setError('Please enter both username and group key');
      return;
    }

    if (groupKey.length !== 6) {
      setError('Invalid group key format');
      return;
    }

    try {
      setIsJoining(true);
      const response = await fetch('/api/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          key: groupKey,
          userId,
          username
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join group');
      }

      const sessionData = await response.json();
      setMembers(sessionData.members);
      setIsInLobby(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartSession = async () => {
    try {
      const response = await fetch('/api/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          key: groupKey,
          userId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start session');
      }

      router.push(`/group/preferences?key=${groupKey}&userId=${userId}&username=${username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const handleLeaveGroup = () => {
    setIsInLobby(false);
    setGroupKey('');
    setMembers([]);
    setError(null);
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
          Group Movie Night
        </motion.h2>

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

        <AnimatePresence mode="wait">
          {isInLobby ? (
            <motion.div
              key="lobby"
              className="lobby-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="group-info">
                <h3>Group Key: {groupKey}</h3>
                <div className="members-list">
                  <h4>Members ({members.length}/10):</h4>
                  <ul>
                    {members.map(member => (
                      <li key={member.id}>
                        {member.username} {member.isAdmin && '(Admin)'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="lobby-actions">
                {members.find(m => m.id === userId)?.isAdmin ? (
                  <button 
                    className="start-button" 
                    disabled={members.length < 2}
                    onClick={handleStartSession}
                  >
                    Start Session
                  </button>
                ) : (
                  <p className="text-gray-400">Waiting for admin to start...</p>
                )}
                <button 
                  className="leave-button"
                  onClick={handleLeaveGroup}
                >
                  Leave Group
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="options"
              className="group-options"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="option-card create-group">
                <h3>Create a Group</h3>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isCreating}
                />
                <motion.button
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateGroup}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <div className="loading-spinner" />
                  ) : (
                    'Create Group'
                  )}
                </motion.button>
              </div>

              <div className="option-card join-group">
                <h3>Join a Group</h3>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isJoining}
                />
                <input
                  type="text"
                  placeholder="Enter group key"
                  value={groupKey}
                  onChange={(e) => setGroupKey(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={isJoining}
                />
                <motion.button
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleJoinGroup}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <div className="loading-spinner" />
                  ) : (
                    'Join Group'
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Magical sparkles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sparkles"></div>
      </div>
    </main>
  );
} 