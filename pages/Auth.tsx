import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { User, Lock, Key, AlertCircle } from 'lucide-react';

const Auth: React.FC = () => {
  const { signIn, register } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    teacherKey: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    
    try {
        if (isLogin) {
            await signIn(formData.username, formData.password);
        } else {
            
            await register(formData.username, formData.password, role, formData.teacherKey);
        }
    } catch (err: any) {
        setFormError(err.message || t('genericError'));
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
    >
      <div className="w-full max-w-md z-10 relative">
        <div className="text-center mb-6">
                    <img 
                        src="/logo.png" 
                        alt="INGO Logo" 
                        className="mx-auto mb-2 drop-shadow-lg h-auto max-w-full"
                        style={{ width: 'auto', height: 'auto' }}
                    />
          <p className="text-gray-300 font-medium">{t('competitiveQuizArena')}</p>
        </div>

        <GlassPanel className="space-y-6 bg-black/60 backdrop-blur-xl">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold font-display">{isLogin ? t('loginTitle') : t('registerTitle')}</h2>
            
            {!isLogin && (
                <div className="flex justify-center gap-4 mt-4">
                    <button 
                        type="button"
                        onClick={() => setRole('student')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${role === 'student' ? 'bg-primary text-white' : 'bg-base text-gray-400 hover:text-white'}`}
                    >
                        {t('student')}
                    </button>
                    <button 
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${role === 'teacher' ? 'bg-gold text-black' : 'bg-base text-gray-400 hover:text-white'}`}
                    >
                        {t('teacher')}
                    </button>
                </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            
            <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder={t('username')}
                    required
                    className="w-full bg-base/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-primary focus:outline-none transition-colors text-sm"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                />
            </div>
            
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="password" 
                    placeholder={t('password')}
                    required
                    className="w-full bg-base/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-primary focus:outline-none transition-colors text-sm"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                />
            </div>

            {!isLogin && role === 'teacher' && (
                <div className="relative animate-in slide-in-from-top-2">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold" />
                    <input 
                        type="text" 
                        placeholder={t('teacherKeyPlaceholder')}
                        className="w-full bg-gold/10 border border-gold/30 text-gold placeholder-gold/50 rounded-xl py-3 pl-12 pr-4 focus:border-gold focus:outline-none transition-colors text-sm"
                        value={formData.teacherKey}
                        onChange={e => setFormData({...formData, teacherKey: e.target.value})}
                    />
                </div>
            )}

            {formError && (
                <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm animate-pulse">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                </div>
            )}

            <Button type="submit" fullWidth className="mt-4" isLoading={isSubmitting}>
                {isSubmitting 
                    ? (isLogin ? t('loggingIn') : t('registering'))
                    : (isLogin ? t('loginBtn') : t('registerBtn'))
                }
            </Button>
          </form>

          {/* Language Flags */}
          <div className="flex justify-center gap-4 pt-2 border-t border-white/5">
                <button 
                    type="button" 
                    onClick={() => setLanguage('tr')}
                    className={`p-1 rounded-xl border-2 transition-all ${language === 'tr' ? 'border-primary bg-primary/10' : 'border-transparent opacity-50'}`}
                    aria-label="Turkce"
                >
                    <img src="/TR.png" alt="TR" className="h-9 w-auto object-contain" />
                </button>
                <button 
                    type="button" 
                    onClick={() => setLanguage('en')}
                    className={`p-1 rounded-xl border-2 transition-all ${language === 'en' ? 'border-primary bg-primary/10' : 'border-transparent opacity-50'}`}
                    aria-label="English"
                >
                    <img src="/EN.png" alt="EN" className="h-9 w-auto object-contain" />
                </button>
          </div>

          <div className="text-center">
            <button 
                type="button"
                onClick={() => {
                    setIsLogin(!isLogin);
                    setIsSubmitting(false);
                    setFormError(null);
                }}
                className="text-sm text-gray-400 hover:text-white underline underline-offset-4"
                disabled={isSubmitting}
            >
                {isLogin ? t('switchToRegister') : t('switchToLogin')}
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};

export default Auth;
