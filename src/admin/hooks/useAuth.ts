import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export type AdminRole = 'admin' | 'mfa';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AdminRole | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface UseAuthReturn extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    role: null,
  });

  const fetchRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('admin_profiles')
      .select('role, is_active')
      .eq('id', userId)
      .single();

    if (data?.is_active) {
      return data.role as AdminRole;
    }
    // Fallback: User ohne admin_profiles Eintrag = admin (Abwärtskompatibilität)
    return 'admin' as AdminRole;
  }, []);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let role: AdminRole | null = null;
      if (session?.user) {
        role = await fetchRole(session.user.id);
      }
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        role,
      });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        let role: AdminRole | null = null;
        if (session?.user) {
          role = await fetchRole(session.user.id);
        }
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          role,
        });
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return { error: 'E-Mail oder Passwort falsch' };
    }

    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    ...state,
    login,
    logout,
    isAuthenticated: !!state.session,
    isAdmin: state.role === 'admin',
  };
}
