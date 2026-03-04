
export type Role = 'student' | 'teacher';

export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  role: Role;
  total_points: number;
  total_trophies: number;
  created_at?: string;
  banned?: boolean;
}

export interface TeacherClass {
  id: string;
  name: string;
  teacher_id: string;
  students: { 
    id: string; 
    username: string; 
    avatar_url: string;
    total_points?: number;
    total_trophies?: number;
    banned?: boolean;
    status?: 'pending' | 'approved';
  }[];
}

export type QuestionType = 'multiple-choice' | 'text' | 'estimation';

export interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: string;
  type: QuestionType;
  duration?: number;
}

export interface Category {
  id: string;
  name: string;
  owner_id: string;
  questions: Question[];
  mode: QuestionType;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: 'waiting' | 'playing' | 'finished';
  current_question_index: number;
  players: RoomPlayer[];
  settings: {
    questionCount: number;
    category_id: string;
    timePerQuestion: number;
  };
}

export interface RoomPlayer {
  id: string;
  username: string;
  avatar_url?: string;
  score: number;
  is_host: boolean;
  last_answer_correct?: boolean | null;
  last_answer_val?: string;
}