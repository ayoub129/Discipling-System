'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  username: string;
  fullName: string;
  email: string;
  avatar: string | null;
  level: number;
  currentXP: number;
  requiredXP: number;
  rank: string;
  streakDays: number;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<UserProfile>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);

  const STORAGE_KEY = 'ayoub-user-data';

  // Save user data to localStorage
  const saveToLocalStorage = (userData: UserProfile) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      }
    } catch (err) {
      console.error('Error saving user data to localStorage:', err);
    }
  };

  // Load user data from localStorage
  const loadFromLocalStorage = (): UserProfile | null => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      }
    } catch (err) {
      console.error('Error loading user data from localStorage:', err);
    }
    return null;
  };

  const fetchUserData = async () => {
    // If already fetching, return the existing promise
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    // If already fetched, don't fetch again
    if (fetchedRef.current && user) {
      return;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(true);
        setError(null);

        // Only call the API if we have a Supabase session (avoids 401 when not logged in)
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setUser(null);
          setLoading(false);
          fetchPromiseRef.current = null;
          return;
        }

        const response = await fetch('/api/user-profile', { credentials: 'include' });

        if (response.status === 401) {
          // Not logged in or session expired – clear user, don't treat as error
          setUser(null);
          setLoading(false);
          fetchPromiseRef.current = null;
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();
        const userData: UserProfile = {
          username: data.username,
          fullName: data.fullName,
          email: data.email,
          avatar: data.avatar,
          level: data.level,
          currentXP: data.currentXP,
          requiredXP: data.requiredXP,
          rank: data.rank,
          streakDays: data.streakDays || 0,
        };

        setUser(userData);
        saveToLocalStorage(userData);
        fetchedRef.current = true;
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user data');
      } finally {
        setLoading(false);
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  };

  useEffect(() => {
    // Try to load from localStorage first for instant display
    const storedUser = loadFromLocalStorage();
    if (storedUser) {
      setUser(storedUser);
    }

    // Then check session and fetch fresh data (only calls API when logged in)
    fetchUserData();
  }, []);

  const refreshUser = async () => {
    fetchedRef.current = false;
    fetchPromiseRef.current = null;
    await fetchUserData();
  };

  const updateUser = (data: Partial<UserProfile>) => {
    setUser(prev => {
      const updated = prev ? { ...prev, ...data } : null;
      if (updated) {
        saveToLocalStorage(updated);
      }
      return updated;
    });
  };

  return (
    <UserContext.Provider value={{ user, loading, error, refreshUser, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
