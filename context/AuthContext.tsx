import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, Role } from '../types';
import { useLanguage } from './LanguageContext';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signIn: (username: string, password?: string) => Promise<void>; 
  verifyPassword: (password: string) => Promise<void>;
  register: (username: string, password: string, role: Role, teacherKey?: string) => Promise<void>;
  updateProfile: (avatar: string, password?: string, avatarFile?: File | null) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateEmail = (username: string) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@ingo.game`;

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        const maxWidth = 500;
        const maxHeight = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) {
            reject(new Error('Canvas context failed'));
            return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        ctx.canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.7);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (data.session?.user) {
          await handleUserSession(data.session.user.id);
        } else {
          setLoading(false);
        }
      } catch (e: any) {
        console.error("Session check error", e);
        if (e?.message && (e.message.includes("Refresh Token Not Found") || e.message.includes("Invalid Refresh Token"))) {
            await supabase.auth.signOut();
        }
        setUser(null);
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESH_REVOKED') {
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
         await handleUserSession(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ban Kontrol
  useEffect(() => {
      if (!user) return;

      const channel = supabase.channel(`public:profiles:${user.id}`)
          .on('postgres_changes', 
              { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
              (payload) => {
                  const updatedProfile = payload.new as Profile;
                    if (updatedProfile.banned) {
                            signOut().then(() => alert(t('bannedAccountMessage')));
                  }
              }
          )
          .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleUserSession = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        if (data.banned) {
            await signOut();
            alert(t('bannedAccountMessage'));
            return;
        }
        setUser(data as Profile);
      } else {
        console.warn("User has session but no profile data found.");
      }
    } catch (err) {
      console.error("Auth Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password?: string) => {
    if (!password) throw new Error(t('passwordRequired'));
    const email = generateEmail(username);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
        console.error("Login error:", error);
        throw new Error(t('invalidCredentials'));
    }

    if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('banned').eq('id', data.user.id).single();
        if (profile?.banned) {
            await signOut();
            throw new Error(t('bannedAccountMessage'));
        }
    }
  };

  const verifyPassword = async (password: string) => {
    if (!user) throw new Error(t('userNotFound'));
    if (!password) throw new Error(t('passwordRequired'));

    const email = generateEmail(user.username);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(t('invalidCredentials'));
    }
  };

  const register = async (username: string, password: string, role: Role, teacherKey?: string) => {
      if (!username || !password) throw new Error(t('usernameAndPasswordRequired'));
      
      if (role === 'teacher' && teacherKey !== '1453fsm') {
          throw new Error(t('invalidTeacherKey'));
      }

      const email = generateEmail(username);
      
      // Random Avatar Sitesi
      const randomSeed = Math.random().toString(36).substring(7) + Date.now().toString();
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
              data: { username, role, avatar_url: avatar }
          }
      });

      if (authError) {
          if (authError.message.includes("already registered") || authError.message.includes("unique constraint")) {
              throw new Error(t('usernameTaken'));
          }
          throw authError;
      }

      if (authData.user) {
          const newProfile: Profile = {
              id: authData.user.id,
              username,
              role,
              avatar_url: avatar,
              total_points: 0,
              total_trophies: 0,
              banned: false, 
              created_at: new Date().toISOString()
          };

          const { error: profileError } = await supabase.from('profiles').insert(newProfile);

          if (profileError) {
              console.error("Profile creation failed:", profileError);
              throw new Error(t('profileCreateFailed'));
          }

          setUser(newProfile);
          setLoading(false);
      }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
      try {
          const compressedBlob = await compressImage(file);

          const fileName = `${Math.random()}.jpg`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, compressedBlob, {
                  contentType: 'image/jpeg',
                  upsert: true
              });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          return `${data.publicUrl}?t=${Date.now()}`;
      } catch (error) {
          console.error("Avatar upload failed:", error);
          return null;
      }
  };

  const updateProfile = async (avatar: string, password?: string, avatarFile?: File | null) => {
      if (!user) return;

      try { supabase.realtime.connect(); } catch {}

      let finalAvatar = avatar;
      if (avatarFile) {
          const uploaded = await uploadAvatar(avatarFile);
          if (!uploaded) throw new Error('Avatar upload failed');
          finalAvatar = uploaded;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: finalAvatar })
        .eq('id', user.id);

      if (error) throw error;

      if (password) {
          const { error: passError } = await supabase.auth.updateUser({ password });
          if (passError) throw passError;
      }
      
      setUser(prev => prev ? { ...prev, avatar_url: finalAvatar } : null);
  };

  const deleteAccount = async () => {
      if (!user) return;
      try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          const accessToken = sessionData.session?.access_token;
          if (!accessToken) throw new Error(t('sessionNotFound'));

          const apiBase = ((import.meta as any).env?.VITE_ADMIN_API_URL as string | undefined) || '';
          const response = await fetch(`${apiBase}/api/delete-self`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${accessToken}`
              }
          });

          if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload?.error || t('accountDeleteIncomplete'));
          }

          await signOut();
      } catch (e) {
          console.error("Delete account error:", e);
          throw e;
      }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, verifyPassword, register, updateProfile, deleteAccount, signOut, uploadAvatar }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
