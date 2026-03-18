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

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        role: null,
      });

      // Rolle asynchron nachladen (blockiert nicht das Laden)
      if (session?.user) {
        supabase
          .from('admin_profiles')
          .select('role, is_active')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            const role: AdminRole = data?.is_active ? (data.role as AdminRole) : 'admin';
            setState(prev => ({ ...prev, role }));
          })
          .then(null, () => {
            setState(prev => ({ ...prev, role: 'admin' }));
          });
      }
    });

    // Listen for auth changes (synchroner Callback!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          role: null,
        });

        if (session?.user) {
          supabase
            .from('admin_profiles')
            .select('role, is_active')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              const role: AdminRole = data?.is_active ? (data.role as AdminRole) : 'admin';
              setState(prev => ({ ...prev, role }));
            })
            .catch(() => {
              setState(prev => ({ ...prev, role: 'admin' }));
            });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
