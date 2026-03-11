import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Room, Question, RoomPlayer, Category, TeacherClass, Profile } from '../types';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { RealtimeChannel } from '@supabase/supabase-js';

const normalizeText = (input: string): string => {
  if (!input) return '';
  let text = input.trim().toLocaleLowerCase('tr-TR');
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

const splitAlternatives = (answer: string): string[] => {
  if (!answer) return [];
  const parts = answer.split('/').map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : [answer.trim()];
};

// Full scoring algorithm (ported from ptest.py)
const scoreByPtestAlgorithm = (playerRaw: string, correctRaw: string): number => {
  const correct = correctRaw.trim();
  const player = playerRaw.trim();

  if (correct.length === 0) return 0;
  if (player.length / correct.length < 0.60) return 0;

  let points = 15;
  let wrongCount = 0;

  const minLen = Math.min(correct.length, player.length);
  for (let i = 0; i < minLen; i++) {
    const d = correct[i];
    const k = player[i];

    if (d === k) continue;
    if (d.toLowerCase() === k.toLowerCase()) continue;
    if ((d === 'I' && k === 'ý') || (k === 'I' && d === 'ý')) continue;
    if ((d === 'Ý' && k === 'i') || (k === 'Ý' && d === 'i')) continue;

    wrongCount += 1;
  }

  if (correct.length > player.length) {
    points -= (correct.length - player.length) * 3;
  }

  if (player.length > correct.length) {
    wrongCount += (player.length - correct.length);
  }

  points -= wrongCount * 2;
  return Math.max(0, points);
};

const scoreTextAnswer = (
  playerAnswer: string,
  correctAnswer: string
): { isCorrect: boolean; isPartial: boolean; points: number; similarity: number | null } => {
  const player = playerAnswer.trim();
  if (!player) return { isCorrect: false, isPartial: false, points: 0, similarity: null };

  const alternatives = splitAlternatives(correctAnswer)
    .map(a => a.trim())
    .filter(Boolean);

  let bestPoints = 0;
  for (const alt of alternatives) {
    const points = scoreByPtestAlgorithm(player, alt);
    if (points > bestPoints) bestPoints = points;
    if (bestPoints === 15) break;
  }

  if (bestPoints === 15) {
    return { isCorrect: true, isPartial: false, points: 15, similarity: null };
  }

  if (bestPoints > 0) {
    return { isCorrect: false, isPartial: true, points: bestPoints, similarity: null };
  }

  return { isCorrect: false, isPartial: false, points: 0, similarity: null };
};
interface GameContextType {
  room: Room | null;
  questions: Question[];
  currentQuestion: Question | null;
  timer: number;
  isHost: boolean;
  categories: Category[];
  joinRoom: (code: string) => Promise<{ success: boolean; message?: string }>;
  createRoom: (settings: { category_id: string; questionCount: number; timePerQuestion: number }) => Promise<string>;
  addCategory: (category: Omit<Category, 'id' | 'owner_id'>) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  startGame: () => void;
  updateAnswer: (answer: string) => void;
  leaveRoom: () => Promise<void>; 
  kickPlayer: (playerId: string) => void;
  banPlayer: (playerId: string) => Promise<void>;
  nextQuestion: () => void;
  getLeaderboard: () => Promise<any[]>;
  searchStudent: (username: string) => Promise<any | null>;
  timeExpired: boolean;
  getClasses: () => Promise<TeacherClass[]>;
  createClass: (name: string) => Promise<TeacherClass | null>;
  deleteClass: (id: string) => Promise<{ error: any }>;
  addStudentToClass: (classId: string, students: any[]) => Promise<void>;
  removeStudentFromClass: (classId: string, studentId: string, currentStudents: any[]) => Promise<void>;
  toggleBan: (studentId: string, currentStatus: boolean) => Promise<void>;
  // New Methods for Class Join Requests
  searchTeacher: (username: string) => Promise<Profile | null>;
  getTeacherClassesPublic: (teacherId: string) => Promise<TeacherClass[]>;
    requestJoinClass: (classId: string, currentStudents: any[]) => Promise<boolean>;
  resolveClassRequest: (classId: string, studentId: string, currentStudents: any[], approved: boolean) => Promise<void>;
  getMyStudentClasses: () => Promise<TeacherClass[]>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth(); 
  const { t } = useLanguage();
  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [timer, setTimer] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [subscriptionKey, setSubscriptionKey] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const questionsRef = useRef<Question[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundScoredRef = useRef<boolean>(false);
  const endGameUpdatedRef = useRef<boolean>(false);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const isHost = room?.host_id === user?.id;

  const currentQuestion = room && room.status === 'playing' 
    ? questions[room.current_question_index] 
    : null;

  useEffect(() => {
    const fetchCategories = async () => {
        let query = supabase.from('categories').select('*');
        if (user && user.role === 'teacher') {
            query = query.eq('owner_id', user.id);
        }
        const { data } = await query;
        if (data) setCategories(data as Category[]);
    };
    if (user) fetchCategories();
  }, [user]);

  useEffect(() => {
    const resubscribeAndSyncRoom = async () => {
      setSubscriptionKey(prev => prev + 1);

      if (roomRef.current?.id) {
        console.log("Syncing Room State via REST...");
        const { data: freshRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomRef.current.id)
          .single();

        if (freshRoom) {
          setRoom(freshRoom as Room);
        }
      }
    };

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        await resubscribeAndSyncRoom();
      }
    };

    const handleRealtimeReconnect = async () => {
      await resubscribeAndSyncRoom();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('ingo:realtime-reconnect', handleRealtimeReconnect as EventListener);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('ingo:realtime-reconnect', handleRealtimeReconnect as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!room?.id) return;
    
    if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
    }

    console.log(`Subscribing to room channel: ${room.id} (Attempt: ${subscriptionKey})`);

    const channel = supabase.channel(`room_game:${room.id}`, {
        config: {
            broadcast: { self: true }, 
            presence: { key: user?.id },
        }
    });

    channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload) => {
          const updatedRoom = payload.new as Room;

          if (roomRef.current?.status === 'waiting' || updatedRoom.status === 'finished' || updatedRoom.players.length !== roomRef.current?.players.length) {
              setRoom(updatedRoom);
               if (user && updatedRoom.players && !updatedRoom.players.some(p => p.id === user.id)) {
                  alert(t('kickedByHost'));
                  setRoom(null);
                  setQuestions([]);
              }
          }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => {
          alert(t('roomClosed'));
          setRoom(null);
          setQuestions([]);
      })
      .on('broadcast', { event: 'GAME_STATE_UPDATE' }, ({ payload }) => {
          if (payload.room) setRoom(payload.room);
          if (payload.questions) setQuestions(payload.questions);
      })
      .on('broadcast', { event: 'TOTALS_UPDATED' }, () => {
          endGameUpdatedRef.current = true;
      })
      .on('broadcast', { event: 'SYNC_TIMER' }, ({ payload }) => {
          setTimer(payload.time);
          setTimeExpired(payload.expired);
      })
      .on('broadcast', { event: 'PLAYER_MOVE' }, ({ payload }) => {
          if (roomRef.current?.host_id === user?.id) {
              handlePlayerMove(payload.playerId, payload.answer);
          }
      })
      .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
              console.log("Joined Game Room Channel Successfully");
              channelRef.current = channel;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              console.warn("Room Channel Disconnected or Error:", status);
          }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [room?.id, subscriptionKey, t]);

  useEffect(() => {
    if (!isHost || room?.status !== 'playing') return;

    if (timerRef.current) clearInterval(timerRef.current);

    const tick = () => {
        setTimer((prev) => {
            if (prev <= 0) {
                if (!timeExpired) {
                    setTimeExpired(true);
                    broadcastTimer(0, true);
                    
                    if (!roundScoredRef.current) {
                        roundScoredRef.current = true;
                        calculateScores();
                    }
                }
                return 0;
            }
            broadcastTimer(prev - 1, false);
            return prev - 1;
        });
    };

    timerRef.current = setInterval(tick, 1000);

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHost, room?.status, room?.current_question_index, timeExpired]); 

  useEffect(() => {
      roundScoredRef.current = false;
  }, [room?.current_question_index]);


  useEffect(() => {
      if (room?.status === 'finished' && user && !user.role.includes('teacher') && !endGameUpdatedRef.current) {
          const myPlayerStats = room.players.find(p => p.id === user.id);
          if (myPlayerStats && myPlayerStats.score > 0) {
              endGameUpdatedRef.current = true;
              
              const maxScore = Math.max(...room.players.map(p => p.score));
              const isWinner = myPlayerStats.score === maxScore && maxScore > 0;

              supabase.from('profiles').select('total_points, total_trophies').eq('id', user.id).single()
                  .then(({ data: freshProfile }) => {
                      if (freshProfile) {
                          const newPoints = (freshProfile.total_points || 0) + myPlayerStats.score;
                          const newTrophies = isWinner ? (freshProfile.total_trophies || 0) + 1 : (freshProfile.total_trophies || 0);

                          supabase.from('profiles')
                              .update({ total_points: newPoints, total_trophies: newTrophies })
                              .eq('id', user.id)
                              .then(() => {});
                      }
                  });
          }
      }
      
      if (room?.status === 'waiting') {
          endGameUpdatedRef.current = false;
      }
  }, [room?.status, user]);



  const broadcastState = (updatedRoom: Room, updatedQuestions?: Question[]) => {
      channelRef.current?.send({
          type: 'broadcast',
          event: 'GAME_STATE_UPDATE',
          payload: { room: updatedRoom, questions: updatedQuestions }
      });
      setRoom(updatedRoom);
      if(updatedQuestions) setQuestions(updatedQuestions);
  };

  const broadcastTimer = (time: number, expired: boolean) => {
      channelRef.current?.send({
          type: 'broadcast',
          event: 'SYNC_TIMER',
          payload: { time, expired }
      });
  };

  const handlePlayerMove = (playerId: string, answer: string) => {
      if (!roomRef.current) return;
      
      const updatedPlayers = roomRef.current.players.map(p => 
          p.id === playerId ? { ...p, last_answer_val: answer } : p
      );
      
      const newRoomState = { ...roomRef.current, players: updatedPlayers };
      broadcastState(newRoomState);
  };

  const calculateScores = () => {
      if (!roomRef.current) return;
      
      const currentQ = questionsRef.current[roomRef.current.current_question_index];
      if (!currentQ) return;

      const cleanCorrect = normalizeText(currentQ.correctAnswer);
      
      const updatedPlayers = roomRef.current.players.map(p => {
          const playerAnswer = (p.last_answer_val || "").trim();
          let isCorrect = false;
          let points = 0;
          let isPartial = false;
          let similarity = null as number | null;

          if (!playerAnswer) {
              isCorrect = false;
          } else if (currentQ.type === 'multiple-choice') {
              if (normalizeText(playerAnswer) === cleanCorrect) {
                  isCorrect = true;
                  points = 10;
              }
          } else {
              const result = scoreTextAnswer(playerAnswer, currentQ.correctAnswer);
              isCorrect = result.isCorrect;
              isPartial = result.isPartial;
              points = result.points;
              similarity = result.similarity;
          }

          return {
              ...p,
              score: p.score + points,
              last_answer_correct: isCorrect,
              last_answer_partial: isPartial,
              last_answer_similarity: similarity,
          };
      });

      const newRoomState = { ...roomRef.current, players: updatedPlayers };
      broadcastState(newRoomState);
      
      supabase.from('rooms').update({ players: updatedPlayers }).eq('id', roomRef.current.id).then();
  };


  const addCategory = async (categoryData: Omit<Category, 'id' | 'owner_id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('categories').insert({
        name: categoryData.name,
        mode: categoryData.mode,
        questions: categoryData.questions,
        owner_id: user.id
    }).select().single();

    if (!error && data) {
        setCategories(prev => [...prev, data as Category]);
    }
  };

  const updateCategory = async (category: Category) => {
      if (!user) return;
      const { error } = await supabase.from('categories').update({
          name: category.name,
          mode: category.mode,
          questions: category.questions
      }).eq('id', category.id);

      if (!error) {
          setCategories(prev => prev.map(c => c.id === category.id ? category : c));
      }
  };

  const createRoom = async (settings: { category_id: string; questionCount: number; timePerQuestion: number }) => {
    if (!user) return '';
    
    const { data: allRooms } = await supabase
        .from('rooms')
        .select('id, created_at')
        .order('created_at', { ascending: true }); 
    
    if (allRooms && allRooms.length >= 5) {
        const roomsToKeep = 4;
        const numToDelete = allRooms.length - roomsToKeep;
        
        if (numToDelete > 0) {
            const idsToDelete = allRooms.slice(0, numToDelete).map(r => r.id);
            await supabase.from('rooms').delete().in('id', idsToDelete);
        }
    }

    const category = categories.find(c => c.id === settings.category_id);
    if (!category) return '';

    const shuffledQs = [...category.questions].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQs.slice(0, settings.questionCount);
    
    const finalQuestions = selectedQuestions.map(q => {
        let options = q.options;
        if(q.type === 'multiple-choice' && options) {
            options = [...options].sort(() => 0.5 - Math.random());
        }
        return { ...q, options, duration: settings.timePerQuestion };
    });

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomCode = '';
    for (let i = 0; i < 5; i++) {
        roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const newRoomPayload = {
        code: roomCode,
        host_id: user.id,
        status: 'waiting',
        current_question_index: 0,
        settings: settings,
        players: [{ 
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            score: 0,
            is_host: true
        }]
    };

    const { data, error } = await supabase.from('rooms').insert(newRoomPayload).select().single();

    if (error || !data) {
        console.error("Room creation error:", error);
        return '';
    }
    
    setRoom(data as Room);
    setQuestions(finalQuestions);
    return data.code;
  };

  const joinRoom = async (code: string) => {
    if (!user) return { success: false, message: t('userNotLoggedIn') };
    
    const { data: roomData, error } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle();
    if (error || !roomData) return { success: false, message: t('roomNotFound') };

    const targetRoom = roomData as Room;
    
    if (targetRoom.status !== 'waiting') {
        return { success: false, message: t('gameAlreadyStarted') };
    }

    const currentPlayers = targetRoom.players || [];
    const isAlreadyJoined = currentPlayers.some((p: RoomPlayer) => p.id === user.id);
    let updatedPlayers = currentPlayers;
    
    if (!isAlreadyJoined) {
        updatedPlayers = [...currentPlayers, { 
            id: user.id, 
            username: user.username, 
            avatar_url: user.avatar_url, 
            score: 0, 
            is_host: false,
            last_answer_correct: null 
        }];
        
        const { error: updateError } = await supabase.from('rooms').update({ players: updatedPlayers }).eq('id', targetRoom.id);
        if (updateError) return { success: false, message: t('failedToJoinRoom') };
    }

    setRoom({ ...targetRoom, players: updatedPlayers });

    const { data: catData } = await supabase.from('categories').select('*').eq('id', targetRoom.settings.category_id).single();
    if (catData) {
         const cat = catData as Category;
         setQuestions(cat.questions.slice(0, targetRoom.settings.questionCount).map(q => ({
             ...q, 
             duration: targetRoom.settings.timePerQuestion 
         })));
    }

    return { success: true };
  };

  const kickPlayer = async (playerId: string) => {
      if (!room || !isHost) return;
      const updatedPlayers = room.players.filter(p => p.id !== playerId);
      await supabase.from('rooms').update({ players: updatedPlayers }).eq('id', room.id);
      setRoom(prev => prev ? { ...prev, players: updatedPlayers } : null);
  };

  const banPlayer = async (playerId: string) => {
      if (!room || !isHost) return;
            // Ban user in Supabase
            await supabase.from('profiles').update({ banned: true }).eq('id', playerId);
            // Remove from all rooms (kick everywhere)
            const { data: rooms } = await supabase.from('rooms').select('id, players');
            if (rooms) {
                for (const r of rooms as any[]) {
                    if (Array.isArray(r.players) && r.players.some((p: any) => p.id === playerId)) {
                        const newPlayers = r.players.filter((p: any) => p.id !== playerId);
                        await supabase.from('rooms').update({ players: newPlayers }).eq('id', r.id);
                    }
                }
            }
            await kickPlayer(playerId);
  };

  const startGame = async () => {
    if (!room) return;
    const startState = { ...room, status: 'playing' as const, current_question_index: 0 };
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id);
    broadcastState(startState, questions);
    setTimer(questions[0]?.duration || 30);
    setTimeExpired(false);
    broadcastTimer(questions[0]?.duration || 30, false);
  };

  const updateAnswer = (answer: string) => {
    if (!room || !user) return;
    
    if (!isHost) {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'PLAYER_MOVE',
            payload: { playerId: user.id, answer: answer }
        });
        const updatedPlayers = room.players.map(p => 
            p.id === user.id ? { ...p, last_answer_val: answer } : p
        );
        setRoom(prev => prev ? { ...prev, players: updatedPlayers } : null);
    } 
    else {
        handlePlayerMove(user.id, answer);
    }
  };

  const nextQuestion = async () => {
    if (!room || !isHost) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const resetPlayers = room.players.map(p => ({ 
        ...p, 
        last_answer_correct: null, 
        last_answer_partial: null,
        last_answer_similarity: null,
        last_answer_val: null 
    }));
    const nextIdx = room.current_question_index + 1;
    const isFinished = nextIdx >= questions.length;
    const nextStatus = isFinished ? 'finished' : 'playing';

    const nextState: any = { 
        ...room,
        players: resetPlayers,
        current_question_index: nextIdx,
        status: nextStatus
    };

    broadcastState(nextState);

    if (isFinished) {
        try {
            const players = room.players;
            const maxScore = Math.max(...players.map(p => p.score));

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, total_points, total_trophies')
                .in('id', players.map(p => p.id));

            if (profiles) {
                const profMap: Record<string, any> = {};
                profiles.forEach((pr: any) => { profMap[pr.id] = pr; });

                await Promise.all(players.map(async (pl) => {
                    const existing = profMap[pl.id] || { total_points: 0, total_trophies: 0 };
                    const newPoints = (existing.total_points || 0) + (pl.score || 0);
                    const newTrophies = ((existing.total_trophies || 0) + ((pl.score === maxScore && maxScore > 0) ? 1 : 0));
                    await supabase.from('profiles').update({ total_points: newPoints, total_trophies: newTrophies }).eq('id', pl.id);
                }));
            }

            endGameUpdatedRef.current = true;

            channelRef.current?.send({ type: 'broadcast', event: 'TOTALS_UPDATED', payload: {} });

            await supabase.from('rooms').update({ status: 'finished', players: resetPlayers }).eq('id', room.id);
        } catch (err) {
            console.error('Error updating totals on finish:', err);
            await supabase.from('rooms').update({ status: 'finished', players: resetPlayers }).eq('id', room.id);
        }
    } else {
        const nextDuration = questions[nextIdx].duration || 30;
        setTimer(nextDuration);
        setTimeExpired(false); 
        broadcastTimer(nextDuration, false);
    }
  };

  const leaveRoom = async () => {
    if (!room || !user) {
        setRoom(null);
        return;
    }

    if (isHost) {
        try {
            await supabase.from('rooms').delete().eq('id', room.id);
        } catch (error) {
            console.error("Error deleting room:", error);
        }
    } else {
        if (room.status === 'waiting') {
            try {
                const updatedPlayers = room.players.filter(p => p.id !== user.id);
                await supabase.from('rooms').update({ players: updatedPlayers }).eq('id', room.id);
            } catch (error) {
                console.error("Error leaving room:", error);
            }
        }
    }

    setRoom(null);
    setQuestions([]);
    setTimer(0);
    setTimeExpired(false);
    if(channelRef.current) supabase.removeChannel(channelRef.current);
  };

  const getLeaderboard = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('banned', false).order('total_trophies', { ascending: false }).limit(50);
    return data || [];
  };

  const searchStudent = async (username: string) => {
        const { data } = await supabase.from('profiles').select('*').ilike('username', username).eq('role', 'student').eq('banned', false).maybeSingle();
        return data;
  };

  const getClasses = async () => {
      if(!user) return [];
      const { data } = await supabase.from('teacher_classes').select('*').eq('teacher_id', user.id);
      return data as TeacherClass[] || [];
  };

  const createClass = async (name: string) => {
      if(!user) return null;
      const { data: existing } = await supabase
        .from('teacher_classes')
        .select('id')
        .eq('teacher_id', user.id)
        .ilike('name', name.trim())
        .maybeSingle();

      if (existing) {
          return null; 
      }

      try {
        const { data, error } = await supabase.from('teacher_classes').insert({
            name: name.trim(),
            teacher_id: user.id,
            students: []
        }).select().single();
        if(error) return null;
        return data as TeacherClass;
      } catch (error) {
        return null;
      }
  };

  const deleteClass = async (id: string) => {
      if(!user) return { error: 'User not found' };
      const { error } = await supabase
        .from('teacher_classes')
        .delete()
        .eq('id', id)
        .eq('teacher_id', user.id);
      if(error) console.error("Error deleting class:", error);
      return { error };
  };

  const addStudentToClass = async (classId: string, students: any[]) => {
      const { error } = await supabase.from('teacher_classes').update({ students: students }).eq('id', classId);
      if(error) console.error("Error adding student:", error);
  };

  const removeStudentFromClass = async (classId: string, studentId: string, currentStudents: any[]) => {
      const updated = currentStudents.filter(s => s.id !== studentId);
      const { error } = await supabase.from('teacher_classes').update({ students: updated }).eq('id', classId);
      if(error) console.error("Error removing student:", error);
  };

  const toggleBan = async (studentId: string, currentStatus: boolean) => {
      const newStatus = !currentStatus;
      await supabase.from('profiles').update({ banned: newStatus }).eq('id', studentId);
  };


  const searchTeacher = async (username: string) => {
    const { data } = await supabase.from('profiles')
        .select('*')
        .ilike('username', username)
        .eq('role', 'teacher')
        .maybeSingle();
    return data;
  };

  const getTeacherClassesPublic = async (teacherId: string) => {
    const { data } = await supabase.from('teacher_classes')
        .select('id, name, teacher_id, students')
        .eq('teacher_id', teacherId);
    return data as TeacherClass[] || [];
  };

  const requestJoinClass = async (classId: string, currentStudents: any[]) => {
      if (!user) return false;

      try {
          const { data, error } = await supabase.rpc('request_join_class', { class_id: classId });
          if (error) {
              console.error('requestJoinClass rpc error:', error);
              return false;
          }

          if (data === true || data === 't' || data === 1) return true;

          return !!data;
      } catch (err) {
          console.error('requestJoinClass unexpected error:', err);
          return false;
      }
  };

  const resolveClassRequest = async (classId: string, studentId: string, currentStudents: any[], approved: boolean) => {
      let updatedStudents;
      if (approved) {
 
          updatedStudents = currentStudents.map(s => s.id === studentId ? { ...s, status: 'approved' } : s);
      } else {

          updatedStudents = currentStudents.filter(s => s.id !== studentId);
      }
      
      await supabase.from('teacher_classes').update({ students: updatedStudents }).eq('id', classId);
  };

  const getMyStudentClasses = async () => {
      if(!user || user.role !== 'student') return [];
      
      // Need to find classes where student is in list AND status is approved (or undefined for legacy)
      // Supabase JSONB filtering is tricky for array elements. 
      // Fetching all classes and filtering client side is expensive but safest for now without backend function.
      // Optimization: We could fetch all classes, but that's bad. 
      // Better: Store class_id in student profile? No schema change allowed.
      // Constraint workaround: We just fetch all classes (assuming scale isn't massive yet) or rely on teacher logic.
      // Actually, let's just fetch classes where the JSONB contains the ID.
      
      const { data } = await supabase
        .from('teacher_classes')
        .select('*');

      if (!data) return [];
      
      return data.filter((c: TeacherClass) => 
          c.students.some(s => s.id === user.id && (s.status === 'approved' || s.status === undefined))
      );
  };

  return (
    <GameContext.Provider value={{ 
      room, questions, currentQuestion, timer, isHost, categories, timeExpired,
      joinRoom, createRoom, addCategory, updateCategory, startGame, updateAnswer, leaveRoom, kickPlayer, banPlayer, nextQuestion, getLeaderboard, searchStudent,
      getClasses, createClass, deleteClass, addStudentToClass, removeStudentFromClass, toggleBan,
      searchTeacher, getTeacherClassesPublic, requestJoinClass, resolveClassRequest, getMyStudentClasses
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
