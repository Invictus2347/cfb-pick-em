import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// �� DEMO MODE - Set to false to test actual authentication
const DEMO_MODE = false;

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  userEmail: string | null;
  session: Session | null;
  signIn: (email: string) => void; // Keep for demo fallback
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEMO_MODE) {
      // Auto-authenticate in demo mode using real Supabase auth
      console.log('🚀 DEMO MODE: Auto-authenticating with real credentials...');
      
      supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123'
      }).then(({ data, error }) => {
        if (error) {
          console.error('Demo mode auth failed:', error);
          setLoading(false);
          return;
        }
        
        console.log('✅ DEMO MODE: Successfully authenticated as', data.user?.email);
        setSession(data.session);
        setUser(data.user);
        setLoading(false);
      }).catch((error) => {
        console.error('Demo mode auth error:', error);
        setLoading(false);
      });
      
      return;
    }

    // Normal auth flow
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Session check failed:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Demo fallback for testing (iOS simulator issues)
  const signIn = (email: string) => {
    console.log('Demo fallback auth: Signing in with', email);
    // Create a mock session for demo purposes
    const mockUser = {
      id: 'demo-user-id',
      email: email,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      identities: [],
      factors: [],
    } as User;

    const mockSession = {
      access_token: 'demo-token',
      refresh_token: 'demo-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: mockUser,
    } as Session;

    setSession(mockSession);
    setUser(mockUser);
  };

  const signOut = async () => {
    if (DEMO_MODE) {
      console.log('🚀 DEMO MODE: Sign out (will auto re-authenticate in 2 seconds)');
      
      // Sign out from Supabase
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Demo sign out error:', error);
      }
      
      setSession(null);
      setUser(null);
      setLoading(true);
      
      // Auto re-authenticate after a brief delay
      setTimeout(async () => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: 'test@example.com',
            password: 'test123'
          });
          
          if (!error && data.session) {
            console.log('✅ DEMO MODE: Re-authenticated successfully');
            setSession(data.session);
            setUser(data.user);
          }
        } catch (error) {
          console.error('Demo re-auth error:', error);
        }
        setLoading(false);
      }, 2000);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
    // Always reset local state
    setSession(null);
    setUser(null);
  };

  const value = {
    isAuthenticated: !!session,
    user,
    userEmail: user?.email || null,
    session,
    signIn,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
