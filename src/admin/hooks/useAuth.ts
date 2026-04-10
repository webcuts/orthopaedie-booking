import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export type AdminRole = 'admin' | 'mfa' | 'arzt';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AdminRole | null;
  roleLoading: boolean;
  practitionerId: string | null;
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
  isDoctor: boolean;
}

function loadRole(userId: string, setState: React.Dispatch<React.SetStateAction<AuthState>>) {
  setState(prev => ({ ...prev, roleLoading: true }));
  supabase
    .from('admin_profiles')
    .select('role, is_active, practitioner_id')
    .eq('id', userId)
    .single()
    .then(({ data }) => {
      const role: AdminRole = data?.is_active ? (data.role as AdminRole) : 'admin';
      const practitionerId = data?.practitioner_id || null;
      setState(prev => ({ ...prev, role, practitionerId, roleLoading: false }));
    })
    .then(null, () => {
      setState(prev => ({ ...prev, role: 'admin', practitionerId: null, roleLoading: false }));
    });
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    role: null,
    roleLoading: false,
    practitionerId: null,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        role: null,
        roleLoading: !!session?.user,
        practitionerId: null,
      });

      if (session?.user) {
        loadRole(session.user.id, setState);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          role: null,
          roleLoading: !!session?.user,
          practitionerId: null,
        });

        if (session?.user) {
          loadRole(session.user.id, setState);
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
    isDoctor: state.role === 'arzt',
  };
}
