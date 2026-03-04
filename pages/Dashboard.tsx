
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext';
import { GlassPanel } from '../components/GlassPanel';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Trophy, Zap, Plus, LogOut, Settings as SettingsIcon, Crown, Edit, Loader2, Bell, X, Check, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Category, Question, TeacherClass, Profile as UserProfile } from '../types';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { createRoom, joinRoom, addCategory, updateCategory, categories, getLeaderboard, getClasses, resolveClassRequest } = useGame();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [roomCode, setRoomCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [highlightSelfRow, setHighlightSelfRow] = useState(false);
  const selfRowRef = useRef<HTMLDivElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{classId: string, className: string, student: any}[]>([]);

  const [roomConfig, setRoomConfig] = useState({
      category_id: '',
      questionCount: 10,
      timePerQuestion: 30
  });

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<{name: string, mode: 'multiple-choice' | 'text', questions: Question[]}>({
      name: '',
      mode: 'text',
      questions: []
  });
  const [tempQuestion, setTempQuestion] = useState({
      text: '',
      correct: '',
      w1: '', w2: '', w3: ''
  });

  const [userStats, setUserStats] = useState({
    total_points: user?.total_points || 0,
    total_trophies: user?.total_trophies || 0
  });

  const isTeacher = user?.role === 'teacher';
  const studentLeaderboard = useMemo(
    () =>
      leaderboard
        .filter(u => u.role === 'student')
        .sort((a, b) => b.total_points - a.total_points),
    [leaderboard]
  );

  useEffect(() => {
    if (user) {
      // Context'teki bayat veriyi kullanmak yerine DB'den güncel olanı çek
      supabase.from('profiles').select('total_points, total_trophies').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUserStats({
              total_points: data.total_points,
              total_trophies: data.total_trophies
            });
          }
        });
    }
  }, [user?.id]); // Sadece kullanıcı değiştiğinde (login/logout) senkronize et

  useEffect(() => {
    setLoadingLeaderboard(true);
    getLeaderboard().then(data => {
        setLeaderboard(data);
        setLoadingLeaderboard(false);
    });

    // Profil değişikliklerini gerçek zamanlı dinle
    const profileChannel = supabase.channel('realtime_profiles')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (payload) => {
                const updatedProfile = payload.new as UserProfile;
                // Liderlik tablosundaki veriyi güncelle
                setLeaderboard(prev => prev.map(p => {
                    if (p.id === updatedProfile.id) {
                        return {
                            ...p,
                            total_points: updatedProfile.total_points ?? p.total_points,
                            total_trophies: updatedProfile.total_trophies ?? p.total_trophies,
                            banned: updatedProfile.banned ?? p.banned
                        };
                    }
                    return p;
                }));
                
                // Eğer güncellenen profil mevcut kullanıcı ise header stats'ı güncelle
                if (user?.id && updatedProfile.id === user.id) {
                    setUserStats(prev => ({
                        total_points: updatedProfile.total_points ?? prev.total_points,
                        total_trophies: updatedProfile.total_trophies ?? prev.total_trophies
                    }));
                }
            }
        )
        .subscribe();

    let notificationChannel: any = null;
    if (isTeacher) {
        fetchRequests();
        
        notificationChannel = supabase.channel('dashboard_notifications')
            .on(
                'postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'teacher_classes', filter: `teacher_id=eq.${user?.id}` },
                () => {
                    fetchRequests();
                }
            )
            .subscribe();
    }

    return () => { 
        supabase.removeChannel(profileChannel);
        if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, [user?.id, isTeacher]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const fetchRequests = async () => {
      const cls = await getClasses();
      setTeacherClasses(cls);
      
      const reqs: any[] = [];
      cls.forEach(c => {
          if (c.students) {
              c.students.forEach(s => {
                  if (s.status === 'pending') {
                      reqs.push({
                          classId: c.id,
                          className: c.name,
                          student: s
                      });
                  }
              });
          }
      });
      setPendingRequests(reqs);
  };

  const handleCreateRoom = async () => {
    if(!roomConfig.category_id) return;
    setIsCreating(true);
    try {
        const code = await createRoom({
            category_id: roomConfig.category_id,
            questionCount: roomConfig.questionCount,
            timePerQuestion: roomConfig.timePerQuestion
        });
        if (code) navigate('/lobby');
    } catch (e) {
        console.error(e);
        setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    setErrorMsg('');
    if (roomCode.length >= 4) {
      setIsJoining(true);
      try {
        const result = await joinRoom(roomCode);
        if (result.success) {
           navigate('/lobby');
        } else {
           setErrorMsg(result.message || t('roomNotFound'));
           setIsJoining(false);
        }
      } catch (e) {
          setIsJoining(false);
      }
    }
  };

  const handleEditCategory = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      if(!cat) return;
      setEditingCategoryId(cat.id);
      setNewCategory({ name: cat.name, mode: cat.mode as any, questions: cat.questions });
      setIsCategoryModalOpen(true);
      setIsRoomModalOpen(false); 
  };

  const handleAddQuestion = () => {
      if(!tempQuestion.text || !tempQuestion.correct) return;
      
      const q: Question = {
          id: Math.random().toString(36),
          text: tempQuestion.text,
          correctAnswer: tempQuestion.correct,
          type: newCategory.mode,
          options: newCategory.mode === 'multiple-choice' 
            ? [tempQuestion.correct, tempQuestion.w1, tempQuestion.w2, tempQuestion.w3]
            : undefined
      };
      
      setNewCategory(prev => ({ ...prev, questions: [...prev.questions, q] }));
      setTempQuestion({ text: '', correct: '', w1: '', w2: '', w3: '' });
  };

  const removeQuestion = (qId: string) => {
      setNewCategory(prev => ({...prev, questions: prev.questions.filter(q => q.id !== qId)}));
  };

  const handleSaveCategory = async () => {
      if(!newCategory.name || newCategory.questions.length === 0) return;
      
      if (editingCategoryId) {
          const updatedCat: Category = {
              id: editingCategoryId,
              name: newCategory.name,
              owner_id: user?.id || '',
              mode: newCategory.mode,
              questions: newCategory.questions
          };
          await updateCategory(updatedCat);
      } else {
          const cat: any = {
              name: newCategory.name,
              mode: newCategory.mode,
              questions: newCategory.questions
          };
          await addCategory(cat);
      }

      setIsCategoryModalOpen(false);
      setIsRoomModalOpen(true); 
      setEditingCategoryId(null);
      setNewCategory({ name: '', mode: 'text', questions: [] });
  };

  const handleRequestAction = async (classId: string, studentId: string, approved: boolean) => {
      const targetClass = teacherClasses.find(c => c.id === classId);
      if (!targetClass) return;
      
      await resolveClassRequest(classId, studentId, targetClass.students, approved);
      fetchRequests();
  };

  const handleLeaderboardDoubleClick = () => {
    if (isTeacher || !user?.id || loadingLeaderboard) return;
    if (!selfRowRef.current) return;

    selfRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightSelfRow(true);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightSelfRow(false);
      highlightTimeoutRef.current = null;
    }, 700);
  };

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 max-w-6xl mx-auto relative">
      <style>{`
        @keyframes leaderboard-self-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/profile')}>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 p-[2px]">
            <img 
              src={user?.avatar_url} 
              alt="Avatar" 
              className="w-full h-full rounded-full object-cover border-2 border-base"
            />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg leading-tight">{user?.username}</h2>
            <p className="text-xs text-primary font-medium uppercase tracking-wider">{t(`role_${user?.role}`)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            {!isTeacher && (
                <>
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full border border-white/5">
                        <Trophy className="w-4 h-4 text-gold" />
                        <span className="font-bold text-gold">{userStats.total_trophies}</span>
                    </div>
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full border border-white/5">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="font-bold text-white">{userStats.total_points}</span>
                    </div>
                </>
            )}
            
            {isTeacher && (
                <button 
                    onClick={() => setIsNotificationOpen(true)}
                    className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <Bell className="w-6 h-6 text-gray-300" />
                    {pendingRequests.length > 0 && (
                        <span className="absolute top-1 right-1 w-3 h-3 bg-danger rounded-full border-2 border-base animate-pulse" />
                    )}
                </button>
            )}

            <Button variant="ghost" className="p-2" onClick={signOut}>
                <LogOut className="w-5 h-5 text-gray-400" />
            </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leaderboard Section */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-display font-bold">{t('leaderboard')}</h3>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">{t('global')}</span>
          </div>
          
          <GlassPanel className="h-[400px] overflow-hidden flex flex-col p-0 relative">
             <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" onDoubleClick={handleLeaderboardDoubleClick}>
                {loadingLeaderboard ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>{t('loadingLeaderboard')}</span>
                    </div>
                ) : (
                    <>
                        {studentLeaderboard
                            .map((player, i) => (
                            <div
                                key={player.id}
                                ref={player.id === user?.id ? selfRowRef : null}
                                className={`flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors ${i === 0 ? 'border border-yellow-400/80' : ''} ${player.id === user?.id && highlightSelfRow ? 'ring-2 ring-primary/70' : ''}`}
                                style={player.id === user?.id && highlightSelfRow ? { animation: 'leaderboard-self-pop 700ms ease-out' } : undefined}
                            >
                                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                    <span className={`text-gray-500 font-mono w-4 font-bold ${i < 3 ? 'text-gold' : ''}`}>{i + 1}</span>
                                    <div className={`w-8 h-8 rounded-full bg-gray-700 relative ${i === 0 ? 'ring-2 ring-yellow-400' : ''}`}>
                                        {i === 0 && (
                                            <Crown className="w-3.5 h-3.5 text-yellow-400 absolute -top-2 left-1/2 -translate-x-1/2" />
                                        )}
                                        <img src={player.avatar_url} className="rounded-full w-full h-full object-cover" />
                                    </div>
                                    <span className="font-medium text-sm truncate">{player.username}</span>
                                </div>
                                <span className="font-bold text-primary text-sm">{player.total_points}</span>
                            </div>
                        ))}
                        {studentLeaderboard.length === 0 && <p className="text-center text-gray-500 mt-10">{t('noPlayersYet')}</p>}
                    </>
                )}
             </div>
          </GlassPanel>
        </div>

        {/* Actions Section */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-center">
            
            {/* STUDENT VIEW - JOIN ROOM */}
            {!isTeacher && (
                <>
                <GlassPanel className="p-8 space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="w-32 h-32" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-display font-bold mb-2 text-primary">{t('joinGame')}</h3>
                        <p className="text-gray-400">{t('joinRoomDesc')}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input 
                                type="text" 
                                placeholder={t('enterCodePlaceholder')}
                                className={`w-full bg-base border rounded-xl px-6 py-3 font-mono text-xl tracking-widest text-center focus:outline-none focus:shadow-[0_0_15px_rgba(0,123,255,0.3)] transition-all uppercase placeholder:text-gray-700 ${errorMsg ? 'border-danger text-danger' : 'border-white/10 text-white focus:border-primary'}`}
                                maxLength={6}
                                value={roomCode}
                                onChange={(e) => {
                                    setRoomCode(e.target.value.toUpperCase());
                                    setErrorMsg('');
                                }}
                            />
                            <Button onClick={handleJoinRoom} disabled={!roomCode} isLoading={isJoining} className="w-full sm:w-auto min-w-[120px]">
                                {isJoining ? t('joiningRoom') : t('joinBtn')}
                            </Button>
                        </div>
                        {errorMsg && <p className="text-danger text-sm text-center font-bold animate-pulse">{errorMsg}</p>}
                    </div>
                </GlassPanel>
                
                <GlassPanel 
                        className="p-6 cursor-pointer group hover:border-white/20" 
                        hoverEffect
                        onClick={() => navigate('/settings')}
                    >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center">
                            <SettingsIcon className="w-6 h-6 text-gray-300" />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg">{t('settings')}</h4>
                            <p className="text-xs text-gray-400">{t('settingsDesc')}</p>
                        </div>
                    </div>
                </GlassPanel>
                </>
            )}

            {/* TEACHER VIEW - ACTIONS */}
            {isTeacher && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GlassPanel 
                        className="p-6 cursor-pointer group border-primary/30 relative overflow-hidden h-full flex flex-col justify-center min-h-[200px]" 
                        hoverEffect
                        onClick={() => setIsRoomModalOpen(true)}
                    >   
                        <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                        <div className="relative z-10 flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                                <Plus className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-xl">{t('createRoom')}</h4>
                                <p className="text-sm text-gray-400 mt-1">{t('createRoomDesc')}</p>
                            </div>
                        </div>
                    </GlassPanel>

                     <GlassPanel 
                        className="p-6 cursor-pointer group hover:border-white/20 h-full flex flex-col justify-center min-h-[200px]" 
                        hoverEffect
                        onClick={() => navigate('/settings')}
                    >
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-gray-700 flex items-center justify-center">
                                <SettingsIcon className="w-8 h-8 text-gray-300" />
                            </div>
                            <div>
                                <h4 className="font-bold text-xl">{t('settings')}</h4>
                                <p className="text-sm text-gray-400 mt-1">{t('settingsDesc')}</p>
                            </div>
                        </div>
                    </GlassPanel>
                </div>
            )}
        </div>
      </div>

      <div className="w-full flex justify-center items-end pt-8 pb-2 mt-6 md:hidden">
        <img
          src="/by.png"
          alt="By"
          className="w-[82vw] max-w-[520px] h-auto"
        />
      </div>

      <div className="hidden md:flex fixed bottom-0 left-0 right-0 justify-center items-end pb-2 pointer-events-none z-0">
        <img
          src="/by.png"
          alt="By"
          className="h-10 w-auto"
          style={{ transform: 'scale(3)', transformOrigin: 'bottom center' }}
        />
      </div>

      {/* NOTIFICATION SIDEBAR (DRAWER) */}
      {isNotificationOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setIsNotificationOpen(false)}>
              <div 
                className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-white/10 p-4 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}
              >
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <Bell className="w-5 h-5 text-gold" />
                          {t('notifications')}
                      </h3>
                      <button onClick={() => setIsNotificationOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                          <X className="w-5 h-5 text-gray-400" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4">
                      {pendingRequests.length === 0 ? (
                          <div className="text-center text-gray-500 py-10">
                              {t('noNotifications')}
                          </div>
                      ) : (
                          pendingRequests.map((req, idx) => (
                              <div key={`${req.classId}-${req.student.id}-${idx}`} className="bg-white/5 p-3 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-3 mb-2">
                                      <img src={req.student.avatar_url} className="w-10 h-10 rounded-full border border-white/10" />
                                      <div className="overflow-hidden">
                                          <p className="font-bold text-sm truncate">{req.student.username}</p>
                                          <p className="text-xs text-gray-400 truncate">{t('joinClass')}: <span className="text-primary">{req.className}</span></p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                      <Button 
                                        size="sm" 
                                        variant="primary" 
                                        className="flex-1 text-xs py-1"
                                        onClick={() => handleRequestAction(req.classId, req.student.id, true)}
                                      >
                                          <Check className="w-3 h-3 mr-1" /> {t('approve')}
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="danger" 
                                        className="flex-1 text-xs py-1"
                                        onClick={() => handleRequestAction(req.classId, req.student.id, false)}
                                      >
                                          <X className="w-3 h-3 mr-1" /> {t('reject')}
                                      </Button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* CREATE ROOM MODAL */}
      <Modal isOpen={isRoomModalOpen} onClose={() => !isCreating && setIsRoomModalOpen(false)} title={t('createRoom')}>
        <div className="space-y-6">
            <div>
                <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">{t('selectCategory')}</label>
                <div className="flex gap-2">
                    <select 
                        className="flex-1 bg-base border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary"
                        value={roomConfig.category_id}
                        onChange={(e) => setRoomConfig({...roomConfig, category_id: e.target.value})}
                    >
                        <option value="">-- {t('selectCategory')} --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.questions.length} {t('questionsCount')})</option>)}
                    </select>
                    <div className="flex gap-1">
                        {roomConfig.category_id && (
                             <Button variant="secondary" size="sm" onClick={() => handleEditCategory(roomConfig.category_id)}>
                                 <Edit className="w-4 h-4" />
                             </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => { 
                            setEditingCategoryId(null);
                            setNewCategory({ name: '', mode: 'text', questions: [] });
                            setIsRoomModalOpen(false); 
                            setIsCategoryModalOpen(true); 
                        }}>
                            {t('newCategory')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">{t('questionCount')}</label>
                    <input 
                        type="number" 
                        className="w-full bg-base border border-white/10 rounded-xl p-3 text-center font-bold"
                        value={roomConfig.questionCount}
                        onChange={(e) => setRoomConfig({...roomConfig, questionCount: parseInt(e.target.value)})}
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">{t('timePerQuestion')}</label>
                    <input 
                        type="number" 
                        className="w-full bg-base border border-white/10 rounded-xl p-3 text-center font-bold"
                        value={roomConfig.timePerQuestion}
                        onChange={(e) => setRoomConfig({...roomConfig, timePerQuestion: parseInt(e.target.value)})}
                    />
                </div>
            </div>

            <Button fullWidth size="lg" onClick={handleCreateRoom} disabled={!roomConfig.category_id} isLoading={isCreating}>
                {isCreating ? t('creatingRoom') : t('start')}
            </Button>
        </div>
      </Modal>

      {/* NEW/EDIT CATEGORY MODAL */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title={editingCategoryId ? t('editCategory') : t('createCategory')}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
             <div>
                <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">{t('categoryName')}</label>
                <input 
                    type="text" 
                    className="w-full bg-base border border-white/10 rounded-lg p-2"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                />
             </div>
             <div>
                <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">{t('gameMode')}</label>
                <select 
                     className="w-full bg-base border border-white/10 rounded-lg p-2"
                     value={newCategory.mode}
                     onChange={(e) => setNewCategory({...newCategory, mode: e.target.value as any})}
                >
                    <option value="text">{t('modeClassic')}</option>
                    <option value="multiple-choice">{t('modeMulti')}</option>
                </select>
             </div>
             
             {/* Question List for Editing */}
             <div className="space-y-2">
                 <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">{t('questionsCount')} ({newCategory.questions.length})</label>
                 {newCategory.questions.map((q, idx) => (
                     <div key={q.id || idx} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-sm">
                         <span className="truncate flex-1 mr-2">{q.text}</span>
                         <button onClick={() => removeQuestion(q.id)} className="text-danger hover:bg-danger/10 p-1 rounded">
                             <LogOut className="w-3 h-3 rotate-180" />
                         </button>
                     </div>
                 ))}
             </div>

             <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                 <h4 className="font-bold text-sm text-primary">{t('newQuestion')}</h4>
                 <input 
                    type="text" 
                    placeholder={t('questionText')}
                    className="w-full bg-base border border-white/10 rounded-lg p-2 text-sm"
                    value={tempQuestion.text}
                    onChange={(e) => setTempQuestion({...tempQuestion, text: e.target.value})}
                 />
                 <input 
                    type="text" 
                    placeholder={t('answerText')}
                    className="w-full bg-base border border-green-500/30 rounded-lg p-2 text-sm"
                    value={tempQuestion.correct}
                    onChange={(e) => setTempQuestion({...tempQuestion, correct: e.target.value})}
                 />
                 
                 {newCategory.mode === 'multiple-choice' && (
                     <div className="grid grid-cols-3 gap-2">
                         <input type="text" placeholder={t('wrongOption1')} className="bg-base border border-danger/30 rounded p-2 text-xs" value={tempQuestion.w1} onChange={e => setTempQuestion({...tempQuestion, w1: e.target.value})} />
                         <input type="text" placeholder={t('wrongOption2')} className="bg-base border border-danger/30 rounded p-2 text-xs" value={tempQuestion.w2} onChange={e => setTempQuestion({...tempQuestion, w2: e.target.value})} />
                         <input type="text" placeholder={t('wrongOption3')} className="bg-base border border-danger/30 rounded p-2 text-xs" value={tempQuestion.w3} onChange={e => setTempQuestion({...tempQuestion, w3: e.target.value})} />
                     </div>
                 )}

                 <Button size="sm" fullWidth onClick={handleAddQuestion}>{t('addQuestion')}</Button>
             </div>
             
             <Button fullWidth onClick={handleSaveCategory} variant="secondary">
                 {t('saveCategory')}
             </Button>
        </div>
      </Modal>

    </div>
  );
};

export default Dashboard;
