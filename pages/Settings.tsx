import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAudio } from '../context/AudioContext';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, Globe, Trash2, Music } from 'lucide-react';

const VolumeSlider = ({ value, onChange, icon: Icon, label }: { value: number, onChange: (val: number) => void, icon: any, label: string }) => {
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newValue = Math.min(1, Math.max(0, value + delta));
    onChange(Number(newValue.toFixed(2)));
  };

  return (
  <div className="flex flex-col p-4 bg-base/50 rounded-xl gap-3" onWheel={handleWheel}>
    <style>{`
      .custom-slider {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
        width: 100%;
      }

      /* Webkit (Chrome, Safari) track */
      .custom-slider::-webkit-slider-runnable-track {
        background: #374151; /* bg-gray-700 */
        height: 8px;
        border-radius: 8px;
      }

      /* Firefox track */
      .custom-slider::-moz-range-track {
        background: #374151; /* bg-gray-700 */
        height: 8px;
        border-radius: 8px;
        border: none;
      }

      /* Webkit thumb */
      .custom-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        margin-top: -4px; /* (track-height - thumb-height) / 2 */
        background-color: #3b82f6; /* bg-primary */
        height: 16px;
        width: 16px;
        cursor: pointer;
        border-radius: 50%;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
      }

      /* Firefox thumb */
      .custom-slider::-moz-range-thumb {
        border: none;
        border-radius: 50%;
        background-color: #3b82f6; /* bg-primary */
        height: 16px;
        width: 16px;
        cursor: pointer;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
      }

      /* Remove Firefox's dotted outline on focus */
      .custom-slider::-moz-focus-outer {
        border: 0;
      }
    `}</style>
    <div className="flex items-center gap-3 text-gray-300">
      <Icon className={`w-5 h-5 ${value === 0 ? 'text-gray-500' : 'text-gray-200'}`} />
      <span className="font-medium">{label}</span>
      <span className="ml-auto text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded min-w-[3rem] text-center">
        {Math.round(value * 100)}%
      </span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="custom-slider focus:outline-none focus:ring-2 focus:ring-primary/50"
    />
  </div>
  );
};

const Settings: React.FC = () => {
  const { user, deleteAccount } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { soundEffectsVolume, musicVolume, setSoundEffectsVolume, setMusicVolume } = useAudio();
  const navigate = useNavigate();

  const handleDelete = async () => {
      if (confirm(t('deleteWarning'))) {
          try {
              await deleteAccount();
              navigate('/');
          } catch (e) {
              alert(t('deleteFailed'));
          }
      }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="pl-0">
             <ArrowLeft className="w-5 h-5 mr-2" /> {t('back')}
        </Button>
      </div>

      <div className="space-y-6">
        <div className="mb-4">
            <h1 className="text-3xl font-display font-bold">{t('settings')}</h1>
            <p className="text-gray-400">{t('settingsDesc')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Preferences */}
            <GlassPanel>
                <h3 className="font-bold mb-4 text-gray-400 uppercase text-xs tracking-wider">{t('preferences')}</h3>
                <div className="space-y-4">
                    {/* Sound Effects */}
                    <VolumeSlider 
                      label={t('soundEffects')} 
                      icon={Volume2} 
                      value={soundEffectsVolume} 
                      onChange={setSoundEffectsVolume} 
                    />

                    {/* Music */}
                    <VolumeSlider 
                      label={t('music')} 
                      icon={Music} 
                      value={musicVolume} 
                      onChange={setMusicVolume} 
                    />

                    {/* Language */}
                    <div className="flex items-center justify-between p-3 bg-base/50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-gray-400" />
                            <span>{t('language')}</span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setLanguage('tr')}
                                className={`p-1 rounded border-2 transition-all ${language === 'tr' ? 'border-primary bg-primary/10' : 'border-transparent opacity-50'}`}
                                aria-label="Turkce"
                            >
                                <img src="/TR.png" alt="TR" className="h-9 w-auto object-contain" />
                            </button>
                            <button 
                                onClick={() => setLanguage('en')}
                                className={`p-1 rounded border-2 transition-all ${language === 'en' ? 'border-primary bg-primary/10' : 'border-transparent opacity-50'}`}
                                aria-label="English"
                            >
                                <img src="/EN.png" alt="EN" className="h-9 w-auto object-contain" />
                            </button>
                        </div>
                    </div>

                    <div className="px-1 pt-1 text-xs text-gray-400 whitespace-pre-line">
                        {"Code: Berat Kılıç\nDesign: Samet Kılıç"}
                    </div>
                </div>
            </GlassPanel>

            {/* Danger Zone */}
            <GlassPanel className="border-danger/20">
                <h3 className="font-bold mb-4 text-danger uppercase text-xs tracking-wider">{t('dangerZone')}</h3>
                <p className="text-sm text-gray-400 mb-4">{t('deleteWarning')}</p>
                <Button variant="danger" fullWidth className="justify-center" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4" /> {t('deleteAccount')}
                </Button>
            </GlassPanel>
        </div>
      </div>
    </div>
  );
};

export default Settings;
