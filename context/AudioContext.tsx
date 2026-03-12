import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type EffectName = 'click' | 'correct' | 'wrong' | 'time' | 'win';

interface AudioContextType {
  soundEffectsVolume: number;
  musicVolume: number;
  setSoundEffectsVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  playEffect: (name: EffectName, options?: { loop?: boolean; restart?: boolean }) => void;
  stopEffect: (name: EffectName) => void;
}

const SOUND_EFFECTS_VOL_KEY = 'ingo_sound_effects_volume';
const MUSIC_VOLUME_KEY = 'ingo_music_volume';
const MUSIC_TRACKS = ['m1', 'm2', 'm3', 'm4'];

const effectSourceMap: Record<EffectName, string[]> = {
  click: ['/audio/click.ogg', '/audio/click.mp3'],
  correct: ['/audio/duo.correct.ogg', '/audio/duo.correct.mp3'],
  wrong: ['/audio/duo.wrong.ogg', '/audio/duo.wrong.mp3'],
  time: ['/audio/time1.ogg', '/audio/time1.mp3'],
  win: ['/audio/win.ogg', '/audio/win.mp3'],
};

const effectVolumeMap: Record<EffectName, number> = {
  click: 0.35,
  correct: 0.65,
  wrong: 0.65,
  time: 0.4,
  win: 0.8,
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const readStoredVolume = (key: string, fallback: number) => {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const val = parseFloat(raw);
  return isNaN(val) ? fallback : Math.max(0, Math.min(1, val));
};

const shuffle = <T,>(list: T[]): T[] => {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundEffectsVolume, setSoundEffectsVolumeState] = useState<number>(() => readStoredVolume(SOUND_EFFECTS_VOL_KEY, 0.5));
  const [musicVolume, setMusicVolumeState] = useState<number>(() => readStoredVolume(MUSIC_VOLUME_KEY, 0.35));

  const musicVolumeRef = useRef(musicVolume);
  useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);

  const hasInteractedRef = useRef(false);

  useEffect(() => {
    // Tarayıcıların otomatik oynatma politikaları nedeniyle, sesin başlayabilmesi için
    // kullanıcının sayfayla etkileşime girmesi gerekir. Bu fonksiyon, ilk etkileşimde
    // müzik ayarı açıksa müziği başlatır.
    const startMusicOnInteraction = () => {
      hasInteractedRef.current = true;
      if (musicRef.current && musicRef.current.paused && musicVolumeRef.current > 0) {
        if (musicRef.current.src) {
           musicRef.current.play().catch(() => playNextMusicTrack());
        } else {
           playNextMusicTrack();
        }
      }
      // Listener'ları ilk etkileşimden sonra kaldırıyoruz ki tekrar çalışmasın.
      window.removeEventListener('click', startMusicOnInteraction);
      window.removeEventListener('keydown', startMusicOnInteraction);
    };

    window.addEventListener('click', startMusicOnInteraction);
    window.addEventListener('keydown', startMusicOnInteraction);

    return () => {
      window.removeEventListener('click', startMusicOnInteraction);
      window.removeEventListener('keydown', startMusicOnInteraction);
    };
  }, []); 

  const effectRefs = useRef<Record<EffectName, HTMLAudioElement | null>>({
    click: null,
    correct: null,
    wrong: null,
    time: null,
    win: null,
  });
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicQueueRef = useRef<string[]>([]);
  const musicStartingRef = useRef(false);

  const getAudio = useCallback((name: EffectName) => {
    if (!effectRefs.current[name]) {
      const probe = document.createElement('audio');
      const supportsOgg = probe.canPlayType('audio/ogg') !== '';
      const source = supportsOgg ? effectSourceMap[name][0] : effectSourceMap[name][1];
      const audio = new Audio(source);
      audio.preload = 'auto';
      audio.volume = effectVolumeMap[name];
      effectRefs.current[name] = audio;
    }
    return effectRefs.current[name]!;
  }, []);

  const playEffect = useCallback(
    (name: EffectName, options?: { loop?: boolean; restart?: boolean }) => {
      if (soundEffectsVolume <= 0) return;
      const audio = getAudio(name);
      if (options?.restart) {
        audio.currentTime = 0;
      }
      audio.volume = effectVolumeMap[name] * soundEffectsVolume;
      audio.loop = !!options?.loop;
      audio.play().catch(() => {});
    },
    [getAudio, soundEffectsVolume]
  );

  const stopEffect = useCallback(
    (name: EffectName) => {
      const audio = getAudio(name);
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
    },
    [getAudio]
  );

  const stopAllEffects = useCallback(() => {
    (Object.keys(effectRefs.current) as EffectName[]).forEach((name) => {
      const audio = effectRefs.current[name];
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
    });
  }, []);

  const stopMusic = useCallback(() => {
    const audio = musicRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const pickNextTrack = useCallback(() => {
    if (musicQueueRef.current.length === 0) {
      musicQueueRef.current = shuffle(MUSIC_TRACKS);
    }
    return musicQueueRef.current.shift() || null;
  }, []);

  const playNextMusicTrack = useCallback(async () => {
    if (musicStartingRef.current) return;
    const audio = musicRef.current;
    if (!audio) return;

    musicStartingRef.current = true;
    const track = pickNextTrack();
    if (!track) {
      musicStartingRef.current = false;
      return;
    }

    const supportsOgg = audio.canPlayType('audio/ogg') !== '';
    const src = supportsOgg ? `/audio/musics/${track}.ogg` : `/audio/musics/${track}.mp3`;
    audio.src = src;
    audio.volume = musicVolumeRef.current;
    try {
      await audio.play();
    } catch (_) {
      // Browser autoplay policies may block until next interaction.
    } finally {
      musicStartingRef.current = false;
    }
  }, [pickNextTrack]);

  useEffect(() => {
    localStorage.setItem(SOUND_EFFECTS_VOL_KEY, String(soundEffectsVolume));
    if (soundEffectsVolume <= 0) {
      stopAllEffects();
    }
  }, [soundEffectsVolume, stopAllEffects]);

  useEffect(() => {
    localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume));
    if (musicRef.current) {
      musicRef.current.volume = musicVolume;
      // Mute'dan ses açıldığında ve etkileşim olmuşsa başlat
      if (musicVolume > 0 && musicRef.current.paused && hasInteractedRef.current) {
         if (!musicRef.current.src) playNextMusicTrack();
         else musicRef.current.play().catch(() => playNextMusicTrack());
      }
    }
  }, [musicVolume, playNextMusicTrack]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = musicVolume;
    audio.onended = () => {
      playNextMusicTrack();
    };
    musicRef.current = audio;

    // Otomatik başlatmayı dene (tarayıcı izin verirse çalışır)
    playNextMusicTrack();

    return () => {
      audio.pause();
      audio.src = '';
      musicRef.current = null;
    };
  }, [playNextMusicTrack]);

  useEffect(() => {
    const onMouseDown = () => {
      playEffect('click', { restart: true });
    };
    const onKeyDown = () => {
      playEffect('click', { restart: true });
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [playEffect]);

  const setSoundEffectsVolume = useCallback((volume: number) => {
    setSoundEffectsVolumeState(volume);
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    setMusicVolumeState(volume);
  }, []);

  const value = useMemo<AudioContextType>(
    () => ({
      soundEffectsVolume,
      musicVolume,
      setSoundEffectsVolume,
      setMusicVolume,
      playEffect,
      stopEffect,
    }),
    [musicVolume, playEffect, setMusicVolume, setSoundEffectsVolume, soundEffectsVolume, stopEffect]
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
