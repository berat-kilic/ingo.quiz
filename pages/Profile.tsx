import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext'; 
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Crown, Star, Edit, UserPlus, Search, X, Users, Trash2, Zap, Loader2, BookOpen, Send, CheckCircle } from 'lucide-react';
import { TeacherClass, Profile as UserProfile } from '../types';
import { supabase } from '../lib/supabase';

const Profile: React.FC = () => {
  const { user, verifyPassword } = useAuth();
  const { searchStudent, getClasses, createClass, deleteClass, addStudentToClass, removeStudentFromClass, searchTeacher, getTeacherClassesPublic, requestJoinClass, getMyStudentClasses } = useGame();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const isEditing = false;
  const uploading = false;

  // Teacher Side State
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<Record<string, UserProfile>>({});
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState({
    total_points: user?.total_points || 0,
    total_trophies: user?.total_trophies || 0
  });

  const [newClassName, setNewClassName] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState(''); 
  const [searchStatus, setSearchStatus] = useState<string>('');

  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [foundTeacher, setFoundTeacher] = useState<UserProfile | null>(null);
  const [foundTeacherClasses, setFoundTeacherClasses] = useState<TeacherClass[]>([]);
  const [myClasses, setMyClasses] = useState<TeacherClass[]>([]);
  const [selectedMyClassId, setSelectedMyClassId] = useState<string | null>(null);
  const [teacherSearchError, setTeacherSearchError] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  useEffect(() => {
    if(user?.role === 'teacher') {
        loadClassesAndStudents();
    } else if (user?.role === 'student') {
        loadMyClasses();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Mount anında DB'den en güncel puanları çek
      supabase.from('profiles').select('total_points, total_trophies').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUserStats({
              total_points: data.total_points,
              total_trophies: data.total_trophies
            });
          }
        });

      // Kendi profilindeki değişiklikleri anlık dinle
      const channel = supabase.channel(`profile_realtime_${user.id}`)
        .on(
          'postgres_changes',
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${user.id}` 
          },
          (payload) => {
            const updated = payload.new as UserProfile;
            setUserStats(prev => ({
              total_points: updated.total_points ?? prev.total_points,
              total_trophies: updated.total_trophies ?? prev.total_trophies
            }));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  const loadClassesAndStudents = async () => {
      const cls = await getClasses();
      setClasses(cls);

      const allStudentIds = cls.flatMap(c => (c.students || []).map(s => s.id));
      
      if (allStudentIds.length > 0) {

          const { data } = await supabase.from('profiles').select('*').in('id', allStudentIds).eq('banned', false);
          if (data) {
              const profileMap: Record<string, UserProfile> = {};
              data.forEach((p: UserProfile) => {
                  profileMap[p.id] = p;
              });
              setStudentProfiles(profileMap);
              // Sınıf listesinden banlıları çıkar
              setClasses(prev => prev.map(c => ({
                  ...c,
                  students: (c.students || []).filter(s => profileMap[s.id])
              })));
          }
      }
  };

  const loadMyClasses = async () => {
      const myCls = await getMyStudentClasses();
      const allStudentIds = Array.from(new Set(myCls.flatMap(c => (c.students || []).map(s => s.id))));

      if (allStudentIds.length === 0) {
          setMyClasses(myCls);
          return;
      }

            const { data } = await supabase
                .from('profiles')
                .select('*') // Hata almamak için tüm alanları seçiyoruz
                .in('id', allStudentIds)
                .eq('banned', false);

      const profileMap: Record<string, UserProfile> = {};
      if (data) data.forEach((p: UserProfile) => { profileMap[p.id] = p; });

      const merged = myCls.map(c => ({
          ...c,
          students: (c.students || []).map(s => ({
              ...s,
              username: profileMap[s.id]?.username ?? s.username,
              avatar_url: profileMap[s.id]?.avatar_url ?? s.avatar_url,
              total_points: profileMap[s.id]?.total_points ?? s.total_points,
              total_trophies: profileMap[s.id]?.total_trophies ?? s.total_trophies,
          }))
      }));

      setMyClasses(merged);
      setStudentProfiles(profileMap);
  };

  const handleTeacherSearch = async () => {
      setTeacherSearchError('');
      setFoundTeacher(null);
      setFoundTeacherClasses([]);

      if (!teacherSearchQuery.trim()) return;

      const teacher = await searchTeacher(teacherSearchQuery.trim());
      if (teacher) {
          setFoundTeacher(teacher);
          const tClasses = await getTeacherClassesPublic(teacher.id);
          setFoundTeacherClasses(tClasses);
      } else {
          setTeacherSearchError(t('teacherNotFound'));
      }
  };

  const handleJoinRequest = async (classId: string) => {
      const cls = foundTeacherClasses.find(c => c.id === classId);
      if (cls && user) {
          const success = await requestJoinClass(classId, cls.students || []);
          if (success) {
              setFoundTeacherClasses(prev => prev.map(c => 
                  c.id === classId ? { ...c, students: [...(c.students || []), { id: user.id, username: user.username, avatar_url: user.avatar_url, status: 'pending' as const }] } : c
              ));
              alert(t('requestSent'));
          } else {
              alert(t('requestFailed'));
          }
      }
  };

  const handleCreateClass = async () => {
      if(!newClassName.trim()) return;
      if (classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase())) {
          alert(t('classAlreadyExists'));
          return;
      }
      const newClass = await createClass(newClassName.trim());
      if(newClass) {
          setClasses([...classes, newClass]);
          setNewClassName('');
      } else {
          alert(t('classCreateFailed'));
      }
  };

  const handleDeleteClass = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(window.confirm(t('classDeleteConfirm'))) {
          const { error } = await deleteClass(id);
          if (!error) {
            setClasses(prev => prev.filter(c => c.id !== id));
            if(selectedClassId === id) setSelectedClassId(null);
          } else {
            alert(t('classDeleteFailed'));
          }
      }
  };

  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentMyClass = myClasses.find(c => c.id === selectedMyClassId);

  const handleAddStudent = async () => {
    if(!studentSearchQuery || !selectedClassId || !currentClass) return;
    
    const student = await searchStudent(studentSearchQuery);
    if(student) {
        // Ekstra kontrol: banned ise eklenemez
        if(student.banned) {
            setSearchStatus(t('bannedCannotBeAdded'));
            return;
        }
        const currentStudents = currentClass.students || [];
        if(currentStudents.some(s => s.id === student.id)) {
            setSearchStatus(t('alreadyTracked'));
        } else {
            const updatedList = [...currentStudents, { 
                id: student.id, 
                username: student.username, 
                avatar_url: student.avatar_url,
                total_points: student.total_points,
                total_trophies: student.total_trophies,
                status: 'approved' as const 
            }];
            
            const updatedClasses = classes.map(c => c.id === selectedClassId ? { ...c, students: updatedList } : c);
            setClasses(updatedClasses);
            setStudentProfiles(prev => ({ ...prev, [student.id]: student }));

            await addStudentToClass(selectedClassId, updatedList);
            setSearchStatus(t('studentAdded'));
            setStudentSearchQuery('');
        }
    } else {
        setSearchStatus(t('studentNotFound'));
    }
    setTimeout(() => setSearchStatus(''), 3000);
  };

  const removeStudent = async (studentId: string) => {
      if(!selectedClassId || !currentClass) return;
      if (!confirm(t('removeStudentConfirm'))) return;

      const currentStudents = currentClass.students || [];
      const updatedList = currentStudents.filter(s => s.id !== studentId);
      const updatedClasses = classes.map(c => c.id === selectedClassId ? { ...c, students: updatedList } : c);
      setClasses(updatedClasses);
      await removeStudentFromClass(selectedClassId, studentId, currentStudents);
  };

  const openProfileSettingsPrompt = () => {
    setCurrentPassword('');
    setPasswordError('');
    setShowPasswordPrompt(true);
  };

  const closeProfileSettingsPrompt = () => {
    setShowPasswordPrompt(false);
    setCurrentPassword('');
    setPasswordError('');
  };

  const handleProfileSettingsAuth = async () => {
    if (!currentPassword.trim()) {
      setPasswordError(t('passwordRequired'));
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');
    try {
      await verifyPassword(currentPassword);
      sessionStorage.setItem('ingo_profile_settings_verified_until', String(Date.now() + 2 * 60 * 1000));
      closeProfileSettingsPrompt();
      navigate('/profile-settings');
    } catch (e: any) {
      setPasswordError(e?.message || t('invalidCredentials'));
    } finally {
      setVerifyingPassword(false);
    }
  };

  if (!user) return null;
  const isStudent = user.role === 'student';

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="pl-0">
             <ArrowLeft className="w-5 h-5 mr-2" /> {t('back')}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Header Card */}
        <GlassPanel className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left relative">
            <button onClick={openProfileSettingsPrompt} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <Edit className="w-4 h-4 text-gray-400" />
            </button>

            <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-gold via-orange-500 to-primary relative overflow-hidden group">
                {uploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-card rounded-full"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>
                ) : (
                    <img src={user.avatar_url} className="w-full h-full rounded-full border-4 border-card object-cover" />
                )}
            </div>
            
            <div className="flex-1">
                <h1 className="text-3xl font-display font-bold mb-1">{user.username}</h1>
                <span className="inline-block px-3 py-1 rounded-full bg-white/5 text-xs uppercase tracking-wider text-gray-400">{t(`role_${user.role}`)}</span>
                
                {isStudent && (
                    <div className="flex items-center justify-center md:justify-start gap-8 mt-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-gold font-display">{userStats.total_trophies}</div>
                            <div className="text-xs text-gray-500 uppercase">{t('trophies')}</div>
                        </div>
                        <div className="w-px h-10 bg-white/10" />
                        <div className="text-center">
                            <div className="text-3xl font-bold text-primary font-display">{userStats.total_points}</div>
                            <div className="text-xs text-gray-500 uppercase">{t('points')}</div>
                        </div>
                    </div>
                )}
            </div>
        </GlassPanel>
        
        {/* --- STUDENT VIEW --- */}
        {isStudent && !isEditing && (
            <>
            {/* 1. FIND TEACHER SECTION */}
            <GlassPanel>
                <div className="flex items-center gap-2 mb-4">
                     <Search className="w-5 h-5 text-gold" />
                     <h3 className="font-bold text-lg">{t('findTeacher')}</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-2 mb-4">
                    <input 
                        type="text" 
                        placeholder={t('searchTeacherPlaceholder')} 
                        className="flex-1 bg-base border border-white/10 rounded-lg p-2"
                        value={teacherSearchQuery}
                        onChange={e => setTeacherSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleTeacherSearch()}
                    />
                    <Button onClick={handleTeacherSearch}>{t('findTeacher')}</Button>
                </div>
                
                {teacherSearchError && <p className="text-danger text-sm mb-4">{teacherSearchError}</p>}

                {foundTeacher && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 animate-in fade-in">
                        <div className="flex items-center gap-3 mb-4">
                            <img src={foundTeacher.avatar_url} className="w-10 h-10 rounded-full" />
                            <span className="font-bold">{foundTeacher.username}</span>
                        </div>
                        
                        <h4 className="text-xs text-gray-400 uppercase font-bold mb-2">{t('teacherClasses')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {foundTeacherClasses.length === 0 ? (
                                <p className="text-sm text-gray-500">{t('noClassesFound')}</p>
                            ) : (
                                foundTeacherClasses.map(cls => {
                                    const currentStudents = cls.students || [];
                                    const status = currentStudents.find(s => s.id === user.id)?.status;
                                    const isPending = status === 'pending';
                                    const isJoined = status === 'approved' || (status === undefined && currentStudents.some(s => s.id === user.id));

                                    return (
                                        <div key={cls.id} className="flex items-center justify-between p-3 bg-base/50 rounded-lg border border-white/5">
                                            <span className="font-medium">{cls.name}</span>
                                            {isJoined ? (
                                                <span className="text-xs text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('alreadyJoined')}</span>
                                            ) : isPending ? (
                                                <span className="text-xs text-gold flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {t('pending')}</span>
                                            ) : (
                                                <Button size="sm" variant="secondary" className="py-1 text-xs" onClick={() => handleJoinRequest(cls.id)}>
                                                    {t('joinClass')}
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </GlassPanel>

            {/* 2. MY CLASSES SECTION (Read-Only Leaderboard) */}
            <GlassPanel>
                <div className="flex items-center gap-2 mb-4">
                     <BookOpen className="w-5 h-5 text-primary" />
                     <h3 className="font-bold text-lg">{t('myClasses')}</h3>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                    {myClasses.length === 0 && <p className="text-sm text-gray-500 w-full text-center py-4">{t('noJoinedClasses')}</p>}
                    {myClasses.map(c => (
                        <div key={c.id} onClick={() => setSelectedMyClassId(c.id)} className={`px-4 py-2 rounded-lg border transition-all cursor-pointer ${selectedMyClassId === c.id ? 'bg-primary border-primary text-white' : 'bg-base border-white/10 text-gray-400 hover:border-white/30'}`}>
                            <span className="font-medium">{c.name}</span>
                        </div>
                    ))}
                </div>

                {selectedMyClassId && currentMyClass && (
                    <div className="animate-in fade-in">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-xs text-gray-500 border-b border-white/5">
                                        <th className="p-3 font-medium uppercase tracking-wider">{t('student')}</th>
                                        <th className="p-3 font-medium uppercase tracking-wider text-center">{t('trophies')}</th>
                                        <th className="p-3 font-medium uppercase tracking-wider text-center">{t('points')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(currentMyClass.students || [])
                                      .filter(s => (s.status === 'approved' || s.status === undefined) && !!studentProfiles[s.id])
                                      .sort((a,b) => (b.total_points || 0) - (a.total_points || 0))
                                      .map((s, idx) => (
                                        <tr key={s.id} className={`hover:bg-white/5 transition-colors ${s.id === user.id ? 'bg-primary/5' : ''}`}>
                                            <td className="p-3 flex items-center gap-3">
                                                <span className="font-mono text-xs text-gray-500 w-4">{idx+1}</span>
                                                <img src={s.avatar_url} className="w-8 h-8 rounded-full bg-gray-700 object-cover border border-white/10" />
                                                <span className={`font-bold text-sm ${s.id === user.id ? 'text-primary' : ''}`}>{s.username}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gold/10 border border-gold/20"><Trophy className="w-3 h-3 text-gold" /><span className="text-xs font-bold text-gold">{s.total_trophies || 0}</span></div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20"><Zap className="w-3 h-3 text-primary" /><span className="text-xs font-bold text-primary">{s.total_points || 0}</span></div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </GlassPanel>
            </>
        )}

        {/* --- TEACHER VIEW --- */}
        {!isStudent && !isEditing && (
            <div className="space-y-6">
                <GlassPanel>
                    <div className="flex items-center gap-2 mb-4">
                         <Users className="w-5 h-5 text-gold" />
                         <h3 className="font-bold text-lg">{t('classes')}</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
                        <input type="text" placeholder={t('className')} className="flex-1 bg-base border border-white/10 rounded-lg p-2" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
                        <Button onClick={handleCreateClass} className="whitespace-nowrap">{t('createClass')}</Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-4">
                        {classes.map(c => (
                            <div key={c.id} onClick={() => setSelectedClassId(c.id)} className={`relative pl-4 pr-10 py-2 rounded-lg border transition-all flex items-center gap-2 cursor-pointer select-none ${selectedClassId === c.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-base border-white/10 text-gray-400 hover:border-white/30'}`}>
                                <span className="font-medium">{c.name}</span>
                                {selectedClassId === c.id && (
                                    <button className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/20 rounded-md cursor-pointer transition-colors group/trash z-10" onClick={(e) => handleDeleteClass(e, c.id)}><Trash2 className="w-4 h-4 text-white/70 group-hover/trash:text-danger" /></button>
                                )}
                            </div>
                        ))}
                    </div>
                </GlassPanel>

                {selectedClassId && currentClass && (
                    <GlassPanel className="animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col gap-4 mb-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gold">{currentClass.name}</h3>
                                <span className="text-xs text-gray-500 uppercase tracking-wider">{(currentClass.students || []).filter(s => s.status === 'approved' || s.status === undefined).length} {t('student')}</span>
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type="text" placeholder={t('searchStudentPlaceholder')} className="w-full bg-base border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none" value={studentSearchQuery} onChange={(e) => setStudentSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()} />
                                </div>
                                <Button size="sm" onClick={handleAddStudent}><UserPlus className="w-4 h-4" /></Button>
                            </div>
                            {searchStatus && <p className="text-sm text-gold animate-pulse">{searchStatus}</p>}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-xs text-gray-500 border-b border-white/5">
                                        <th className="p-3 font-medium uppercase tracking-wider">{t('student')}</th>
                                        <th className="p-3 font-medium uppercase tracking-wider text-center">{t('trophies')}</th>
                                        <th className="p-3 font-medium uppercase tracking-wider text-center">{t('points')}</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(currentClass.students || [])
                                      .filter(s => s.status === 'approved' || s.status === undefined)
                                      .sort((a,b) => {
                                          const pA = studentProfiles[a.id]?.total_points || 0;
                                          const pB = studentProfiles[b.id]?.total_points || 0;
                                          return pB - pA;
                                      })
                                      .map((s) => {

                                        const freshData = studentProfiles[s.id] || s;
                                        
                                        return (
                                        <tr key={s.id} className={`hover:bg-white/5 transition-colors group ${freshData.banned ? 'opacity-50 grayscale' : ''}`}>
                                            <td className="p-3 flex items-center gap-3">
                                                <img src={freshData.avatar_url} className="w-8 h-8 rounded-full bg-gray-700 object-cover border border-white/10" />
                                                <div className="flex flex-col"><span className="font-bold text-sm">{freshData.username}</span>{freshData.banned && <span className="text-[10px] text-danger font-bold uppercase">{t('bannedLabel')}</span>}</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gold/10 border border-gold/20"><Trophy className="w-3 h-3 text-gold" /><span className="text-xs font-bold text-gold">{freshData.total_trophies || 0}</span></div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20"><Zap className="w-3 h-3 text-primary" /><span className="text-xs font-bold text-primary">{freshData.total_points || 0}</span></div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button type="button" onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }} className="text-danger hover:bg-danger/10 p-2 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    )})}
                                    {(currentClass.students || []).filter(s => s.status === 'approved' || s.status === undefined).length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">{t('noStudentsTracked')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </GlassPanel>
                )}
            </div>
        )}
      </div>

      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassPanel className="w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">{t('profileSettingsAccess')}</h2>
            <p className="text-sm text-gray-400">{t('profileSettingsPasswordPrompt')}</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleProfileSettingsAuth()}
              className="w-full bg-base border border-white/10 rounded-xl p-3"
              placeholder={t('password')}
            />
            {passwordError && <p className="text-danger text-sm">{passwordError}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={closeProfileSettingsPrompt}>
                {t('cancel')}
              </Button>
              <Button className="flex-1" onClick={handleProfileSettingsAuth} isLoading={verifyingPassword}>
                {t('verify')}
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

export default Profile;
