import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'student' | 'official' | 'staff' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, registerNo?: string) => Promise<{ error: Error | null; data: { user: User | null } | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data: isOfficial, error: officialError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'official',
      });
      if (officialError) console.error('Error checking official role:', officialError);
      if (isOfficial) return 'official' as AppRole;

      // Check staff role via user_roles table directly (since has_role enum may not include 'staff' yet in types)
      const { data: staffRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'staff' as any);
      if (staffRows && staffRows.length > 0) return 'staff' as AppRole;

      const { data: isStudent, error: studentError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'student',
      });
      if (studentError) console.error('Error checking student role:', studentError);
      if (isStudent) return 'student' as AppRole;

      return null;
    } catch (e) {
      console.error('Error fetching user role:', e);
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(async () => {
            const userRole = await fetchUserRole(session.user.id);
            setRole(userRole);
            setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id).then((userRole) => {
          setRole(userRole);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, registerNo?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const metadata: Record<string, string> = {
      full_name: fullName,
    };
    
    // Only include register_no if provided (students only)
    if (registerNo && registerNo.trim()) {
      metadata.register_no = registerNo.trim().toUpperCase();
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });
    return { error, data: data ? { user: data.user } : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
