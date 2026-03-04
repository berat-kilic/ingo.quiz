import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

type DraftState = {
  avatarDataUrl: string | null;
  password: string;
  confirmPassword: string;
};

const fileFromDataUrl = async (dataUrl: string): Promise<File | null> => {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], `profile-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
};

const ProfileSettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const draftKey = useMemo(() => `ingo_profile_settings_draft_${user?.id || 'guest'}`, [user?.id]);

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const awaitingFilePickRef = useRef(false);

  const setFileBusy = () => {
    try {
      sessionStorage.setItem('ingo_profile_settings_file_busy', '1');
    } catch {
      
    }
  };

  const clearFileBusyAndNotify = () => {
    try {
      sessionStorage.removeItem('ingo_profile_settings_file_busy');
    } catch {
      
    }
    window.dispatchEvent(new CustomEvent('ingo:profile-settings-file-ready'));
  };

  useEffect(() => {
    const verifiedUntilRaw = sessionStorage.getItem('ingo_profile_settings_verified_until');
    const verifiedUntil = Number(verifiedUntilRaw || 0);
    if (!verifiedUntil || verifiedUntil < Date.now()) {
      navigate('/profile');
      return;
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    setAvatarPreview(user.avatar_url || '');

    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as DraftState;
      if (draft.avatarDataUrl) {
        setAvatarPreview(draft.avatarDataUrl);
        setPendingAvatarDataUrl(draft.avatarDataUrl);
      }
      setPassword(draft.password || '');
      setConfirmPassword(draft.confirmPassword || '');
    } catch {
      
    }
  }, [draftKey, user]);

  useEffect(() => {
    try {
      const draft: DraftState = {
        avatarDataUrl: pendingAvatarDataUrl,
        password,
        confirmPassword,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      
    }
  }, [draftKey, pendingAvatarDataUrl, password, confirmPassword]);

  useEffect(() => {
    return () => {
      clearFileBusyAndNotify();
    };
  }, []);

  useEffect(() => {
    const onFocus = () => {
      if (!awaitingFilePickRef.current) return;
      setTimeout(() => {
        if (!awaitingFilePickRef.current) return;
        awaitingFilePickRef.current = false;
        clearFileBusyAndNotify();
      }, 300);
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const markFilePickStarted = () => {
    awaitingFilePickRef.current = true;
    setFileBusy();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    awaitingFilePickRef.current = false;
    const file = e.target.files?.[0];
    if (!file) {
      clearFileBusyAndNotify();
      return;
    }

    setPendingAvatarFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) {
        clearFileBusyAndNotify();
        return;
      }
      setPendingAvatarDataUrl(dataUrl);
      setAvatarPreview(dataUrl);
      clearFileBusyAndNotify();
    };
    reader.onerror = () => {
      clearFileBusyAndNotify();
    };
    reader.readAsDataURL(file);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      
    }
    setPendingAvatarDataUrl(null);
    setPendingAvatarFile(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSave = async () => {
    if (!user) return;
    if (password && password !== confirmPassword) {
      alert(t('passwordsDoNotMatch'));
      return;
    }

    setSaving(true);
    try {
      let fileToUpload = pendingAvatarFile;
      if (!fileToUpload && pendingAvatarDataUrl) {
        fileToUpload = await fileFromDataUrl(pendingAvatarDataUrl);
      }

      await updateProfile(avatarPreview, password, fileToUpload);
      clearDraft();
      navigate('/profile');
    } catch (e: any) {
      alert(e?.message ? `${t('saveFailedWithReason')}: ${e.message}` : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto pb-20">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/profile')} className="pl-0">
          <ArrowLeft className="w-5 h-5 mr-2" /> {t('back')}
        </Button>
      </div>

      <GlassPanel className="space-y-5">
        <h1 className="text-2xl font-display font-bold">{t('updateProfile')}</h1>

        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-gold via-orange-500 to-primary overflow-hidden">
            <img src={avatarPreview || user.avatar_url} className="w-full h-full rounded-full border-4 border-card object-cover" />
          </div>
          <label onClick={markFilePickStarted} className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <Upload className="w-4 h-4" />
            <span>{t('selectImage')}</span>
            <input type="file" accept="image/*" className="hidden" onClick={markFilePickStarted} onChange={handleFileUpload} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-2">{t('newPassword')}</label>
            <input
              type="password"
              className="w-full bg-base border border-white/10 rounded-xl p-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('min6CharsPlaceholder')}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">{t('confirmPassword')}</label>
            <input
              type="password"
              className="w-full bg-base border border-white/10 rounded-xl p-3"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('retypePasswordPlaceholder')}
            />
          </div>
        </div>

        <Button fullWidth onClick={handleSave} isLoading={saving}>
          <Save className="w-4 h-4" /> {t('saveChanges')}
        </Button>
      </GlassPanel>
    </div>
  );
};

export default ProfileSettings;
