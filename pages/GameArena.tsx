import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext';
import { useAudio } from '../context/AudioContext';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { Modal } from '../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, XCircle, ArrowRight, Loader2, Users, Ban, LogOut, Menu, Trophy, Zap, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const GameArena: React.FC = () => {
  const { room, currentQuestion, timer, updateAnswer, nextQuestion, isHost, kickPlayer, timeExpired, leaveRoom } = useGame();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { playEffect, stopEffect, soundEffectsEnabled } = useAudio();
  const navigate = useNavigate();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [hasSelected, setHasSelected] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [endGameTotalScores, setEndGameTotalScores] = useState<any[]>([]);
  const [loadingEndGame, setLoadingEndGame] = useState(false);
  const lastResolvedQuestionIdRef = useRef<string | null>(null);
  const winPlayedForRoomRef = useRef<string | null>(null);
  const myPlayer = room?.players.find(p => p.id === user?.id);

  useEffect(() => {
    if (!room) {
        navigate('/dashboard');
        return;
    }
    
    if (room.status === 'finished') {
        setLoadingEndGame(true);
        const playerIds = room.players.map(p => p.id);
        
        supabase.from('profiles').select('id, username, total_points, total_trophies, avatar_url, role')
            .in('id', playerIds)
            .then(({ data }) => {
                if(data) setEndGameTotalScores(data);
                setLoadingEndGame(false);
            });
    }
  }, [room, navigate]);

  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setHasSelected(false);
  }, [currentQuestion]);

  useEffect(() => {
    if (!room || room.status !== 'playing' || !currentQuestion || timeExpired || !soundEffectsEnabled) {
      stopEffect('time');
      return;
    }
    playEffect('time', { loop: true, restart: true });
    return () => {
      stopEffect('time');
    };
  }, [currentQuestion?.id, playEffect, room?.status, soundEffectsEnabled, stopEffect, timeExpired]);

  useEffect(() => {
    if (!room || room.status !== 'playing' || !timeExpired || !currentQuestion) return;
    if (lastResolvedQuestionIdRef.current === currentQuestion.id) return;

    if (typeof myPlayer?.last_answer_correct !== 'boolean') return;

    lastResolvedQuestionIdRef.current = currentQuestion.id;
    stopEffect('time');

    if (myPlayer.last_answer_correct) {
      playEffect('correct', { restart: true });
    } else {
      playEffect('wrong', { restart: true });
    }
  }, [currentQuestion?.id, myPlayer?.last_answer_correct, playEffect, room?.status, stopEffect, timeExpired]);

  useEffect(() => {
    if (room?.status === 'waiting') {
      lastResolvedQuestionIdRef.current = null;
      winPlayedForRoomRef.current = null;
    }
  }, [room?.status]);

  useEffect(() => {
    if (!room || room.status !== 'finished') return;
    stopEffect('time');
    if (winPlayedForRoomRef.current === room.id) return;
    winPlayedForRoomRef.current = room.id;
    playEffect('win', { restart: true });
  }, [playEffect, room?.id, room?.status, stopEffect]);

  const handleSelect = (answer: string) => {
    if (timeExpired) return;
    
    setSelectedOption(answer);
    setTextAnswer(answer);
    setHasSelected(true);
    updateAnswer(answer);
  };

  const handleLeaveAndClose = async () => {
      await leaveRoom();
      navigate('/dashboard');
  };

  const handleExitGame = async () => {
      const msg = isHost 
        ? t('hostExitGameWarning')
        : t('playerExitGameWarning');
      
      if (confirm(msg)) {
          await leaveRoom();
          navigate('/dashboard');
      }
  };

  if (!room) return null;

  if (room.status === 'finished') {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-5xl space-y-8">
                  <div className="text-center">
                      <h1 className="text-4xl font-display font-black text-gold mb-2">{t('gameFinished')}</h1>
                      <p className="text-gray-400">{t('finalResults')}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* TABLE 1: SESSION SCORES (Include Teacher) */}
                      <GlassPanel className="border-primary/20">
                          <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                              <Trophy className="w-5 h-5 text-primary" />
                              <h3 className="font-bold text-lg">{t('gameRanking')}</h3>
                          </div>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                              {room.players
                                .sort((a,b) => b.score - a.score) // çoktan aza
                                .map((p, i) => (
                                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg bg-white/5 ${i === 0 ? 'border border-yellow-400/80' : ''}`}>
                                      <div className="flex items-center gap-3">
                                          <span className="font-mono text-gray-500 w-4">{i+1}</span>
                                          <div className={`w-8 h-8 rounded-full relative ${i === 0 ? 'ring-2 ring-yellow-400' : ''}`}>
                                              {i === 0 && (
                                                  <Crown className="w-3.5 h-3.5 text-yellow-400 absolute -top-2 left-1/2 -translate-x-1/2" />
                                              )}
                                              <img src={p.avatar_url} className="w-8 h-8 rounded-full" />
                                          </div>
                                          <span className="font-bold">{p.username} {p.is_host ? `(${t('hostLabel')})` : ''}</span>
                                      </div>
                                      <span className="font-bold text-primary">+{p.score}</span>
                                  </div>
                              ))}
                          </div>
                      </GlassPanel>

                      {/* TABLE 2: TOTAL CAREER SCORES (Exclude Teacher) */}
                      <GlassPanel className="border-gold/20">
                           <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                              <Crown className="w-5 h-5 text-gold" />
                              <h3 className="font-bold text-lg">{t('overallRanking')}</h3>
                          </div>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                              {loadingEndGame ? (
                                  <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                              ) : (
                                  endGameTotalScores
                                    .filter(p => p.role !== 'teacher') // Öğretmen liste dışı
                                    .sort((a,b) => b.total_points - a.total_points) // çoktan aza
                                    .map((p, i) => (
                                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg bg-white/5 ${i === 0 ? 'border border-yellow-400/80' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-gray-500 w-4">{i+1}</span>
                                            <div className={`w-8 h-8 rounded-full relative ${i === 0 ? 'ring-2 ring-yellow-400' : ''}`}>
                                                {i === 0 && (
                                                    <Crown className="w-3.5 h-3.5 text-yellow-400 absolute -top-2 left-1/2 -translate-x-1/2" />
                                                )}
                                                <img src={p.avatar_url} className="w-8 h-8 rounded-full" />
                                            </div>
                                            <span className="font-bold">{p.username}</span>
                                        </div>
                                        <span className="font-bold text-gold">{p.total_points}</span>
                                    </div>
                                  ))
                              )}
                          </div>
                      </GlassPanel>
                  </div>

                  <div className="flex justify-center pt-4">
                      {isHost ? (
                          <Button size="lg" variant="danger" onClick={handleLeaveAndClose}>
                              <LogOut className="w-5 h-5 mr-2" /> {t('closeRoom')}
                          </Button>
                      ) : (
                          <Button size="lg" variant="secondary" onClick={() => navigate('/dashboard')}>
                              <ArrowRight className="w-5 h-5 mr-2" /> {t('back')}
                          </Button>
                      )}
                  </div>
              </div>
          </div>
      );
  }


  const isCorrect = myPlayer?.last_answer_correct === true;
  
  const rankedPlayers = [...room.players]
    .sort((a,b) => b.score - a.score);

  return (
    <div className="min-h-screen flex flex-col md:flex-row p-4 max-w-7xl mx-auto gap-6 relative">
      
      {/* MOBILE HEADER & DRAWER TOGGLE */}
      {/* Added mt-6 to avoid overlap with fixed connection status dot at top-right */}
      <div className="md:hidden flex justify-between items-center w-full mb-4 mt-6">
           <div className="flex items-center gap-2">
               <span className="text-gray-400 font-mono text-xs">Q{room.current_question_index + 1}</span>
               <div className="h-2 w-24 bg-gray-800 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                        animate={{ width: `${(timer / (currentQuestion?.duration || 30)) * 100}%` }}
                        className={`h-full ${timer < 5 ? 'bg-danger' : 'bg-primary'}`}
                    />
               </div>
               <span className="text-xs font-mono">{timer}s</span>
           </div>
           <Button size="sm" variant="secondary" onClick={() => setIsMobileMenuOpen(true)}>
               <Trophy className="w-4 h-4 mr-1" /> {t('score')}
           </Button>
      </div>

      {/* LEFT SIDE: MAIN GAME */}
      <div className="flex-1 flex flex-col relative">
            {/* Desktop Top Bar */}
            <div className="hidden md:flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-mono text-sm">Q{room.current_question_index + 1}</span>
                </div>
                <div className="flex-1 max-w-md mx-8">
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden relative border border-white/10">
                        <motion.div 
                            animate={{ width: `${(timer / (currentQuestion?.duration || 30)) * 100}%` }}
                            transition={{ ease: "linear", duration: 1 }}
                            className={`h-full ${timer < 5 ? 'bg-danger shadow-[0_0_10px_#FF4D4D]' : 'bg-primary shadow-[0_0_10px_#007BFF]'}`}
                        />
                    </div>
                    <div className="text-center mt-1 text-xs font-mono text-gray-400">{timer}s</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold tracking-wider">{t('live')}</span>
                </div>
            </div>

            {/* Main Arena */}
            <div className="flex-1 flex flex-col justify-center items-center gap-8 relative min-h-[50vh]">
                {currentQuestion && (
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={currentQuestion.id}
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="w-full"
                        >
                            <GlassPanel className="min-h-[200px] flex items-center justify-center text-center p-8 md:p-12 border-primary/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                <h2 className="text-xl md:text-3xl font-display font-bold leading-relaxed">
                                    {currentQuestion.text}
                                </h2>
                            </GlassPanel>
                        </motion.div>
                    </AnimatePresence>
                )}

                {/* Answer Area */}
                <div className="w-full max-w-3xl pb-20 md:pb-0">
                    {currentQuestion?.type === 'multiple-choice' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {currentQuestion.options?.map((opt, idx) => {
                                let btnVariant = 'secondary';
                                if (timeExpired) {
                                    if (opt === currentQuestion.correctAnswer) btnVariant = 'primary';
                                    else if (selectedOption === opt) btnVariant = 'danger';
                                } else if (selectedOption === opt) {
                                    btnVariant = 'secondary_selected'; 
                                }

                                return (
                                    <motion.button
                                        key={idx}
                                        whileTap={!timeExpired ? { scale: 0.98 } : {}}
                                        onClick={() => handleSelect(opt)}
                                        className={`
                                            p-4 md:p-6 rounded-2xl text-left font-bold text-sm md:text-lg transition-all border
                                            ${btnVariant === 'secondary' ? 'bg-card border-white/10 hover:border-primary/50' : ''}
                                            ${btnVariant === 'secondary_selected' ? 'bg-primary/20 border-primary' : ''}
                                            ${btnVariant === 'primary' ? 'bg-green-500/20 border-green-500 text-green-400' : ''}
                                            ${btnVariant === 'danger' ? 'bg-danger/20 border-danger text-danger' : ''}
                                        `}
                                        disabled={timeExpired}
                                    >
                                        <span className="mr-3 opacity-50">{String.fromCharCode(65 + idx)}.</span>
                                        {opt}
                                    </motion.button>
                                )
                            })}
                        </div>
                    )}
                    
                    {currentQuestion?.type === 'text' && (
                         <div className="flex flex-col gap-4">
                            <input 
                                type="text" 
                                value={textAnswer}
                                onChange={(e) => setTextAnswer(e.target.value)}
                                placeholder={t('typeAnswer')}
                                disabled={timeExpired}
                                className="w-full bg-base border border-white/20 rounded-2xl p-6 text-center text-xl outline-none focus:border-primary"
                            />
                            {!timeExpired && (
                                <Button onClick={() => handleSelect(textAnswer)} fullWidth size="lg">
                                    {hasSelected ? t('changeAnswer') : t('submitAnswer')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* RESULT REVEAL */}
                <AnimatePresence>
                    {timeExpired && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-20 md:bottom-0 flex flex-col items-center w-full z-10 pointer-events-none"
                        >
                            <div className={`
                                flex items-center gap-4 px-6 py-3 rounded-full border backdrop-blur-md shadow-xl
                                ${isCorrect ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-danger/20 border-danger text-danger'}
                            `}>
                                {isCorrect ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                <span className="text-xl font-bold">{isCorrect ? t('correct') : t('incorrect')}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Host Controls */}
                {isHost && timeExpired && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed bottom-6 right-6 z-50"
                    >
                        <Button onClick={nextQuestion} size="lg" className="shadow-2xl">
                            {t('nextQuestion')} <ArrowRight className="w-5 h-5" />
                        </Button>
                    </motion.div>
                )}
            </div>
      </div>
      
      {/* EXIT GAME BUTTON (Bottom Left) */}
      <motion.button 
          whileHover={{ scale: 1.1 }}
          onClick={handleExitGame}
          className="fixed bottom-6 left-6 z-50 p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-colors"
          title={t('leaveGameTitle')}
      >
          <LogOut className="w-6 h-6" />
      </motion.button>

      {/* RIGHT SIDE: LIVE SCOREBOARD (Desktop) */}
      <GlassPanel className="w-80 hidden md:flex flex-col p-4 border-l border-white/10 h-[80vh] sticky top-8">
          <ScoreboardContent players={rankedPlayers} t={t} />
      </GlassPanel>

      {/* MOBILE DRAWER: LIVE SCOREBOARD */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
             <div className="absolute right-0 top-0 bottom-0 w-3/4 bg-card border-l border-white/10 p-4" onClick={e => e.stopPropagation()}>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold">{t('leaderboard')}</h3>
                     <button onClick={() => setIsMobileMenuOpen(false)}><XCircle className="w-6 h-6 text-gray-400" /></button>
                 </div>
                 <ScoreboardContent players={rankedPlayers} t={t} />
             </div>
        </div>
      )}

    </div>
  );
};


const ScoreboardContent = ({ players, t }: { players: any[]; t: (key: string) => string }) => (
    <>
      <div className="flex items-center gap-2 mb-4 text-gray-400 border-b border-white/10 pb-2">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="font-bold text-sm">{t('live')} {t('score')}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
          {players.map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between p-2 rounded bg-white/5 text-sm ${i === 0 ? 'border border-yellow-400/80' : ''}`}>
                  <div className="flex items-center gap-2 overflow-hidden">
                      <span className={`font-mono w-4 ${i<3 ? 'text-gold font-bold' : 'text-gray-500'}`}>{i+1}</span>
                      <div className={`w-6 h-6 rounded-full relative ${i === 0 ? 'ring-2 ring-yellow-400' : ''}`}>
                          {i === 0 && (
                              <Crown className="w-3 h-3 text-yellow-400 absolute -top-1.5 left-1/2 -translate-x-1/2" />
                          )}
                          <img src={p.avatar_url} className="w-6 h-6 rounded-full" />
                      </div>
                      <span className="truncate font-medium">{p.username}</span>
                  </div>
                  <span className="font-bold text-primary">{p.score}</span>
              </div>
          ))}
          {players.length === 0 && <p className="text-xs text-gray-500 text-center mt-4">{t('noScoreYet')}</p>}
      </div>
    </>
);

export default GameArena;
