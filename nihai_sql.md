-- 1. TEMİZLİK (CLEANUP)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.teacher_classes CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. TABLOLARIN OLUŞTURULMASI
-- 2.1 PROFILES (Kullanıcı Profilleri)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  avatar_url TEXT,
  total_points INTEGER DEFAULT 0,
  total_trophies INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2 CATEGORIES (Soru Kategorileri)
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT DEFAULT 'text' CHECK (mode IN ('text', 'multiple-choice', 'estimation')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL ise global kategoridir
  questions JSONB DEFAULT '[]'::jsonb, -- Sorular JSON formatında saklanır
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.3 ROOMS (Oyun Odaları)
CREATE TABLE public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  current_question_index INTEGER DEFAULT 0,
  players JSONB DEFAULT '[]'::jsonb, -- Oyuncular ve anlık puanları JSON olarak tutulur
  settings JSONB DEFAULT '{}'::jsonb, -- Oyun ayarları (süre, soru sayısı vb.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.4 TEACHER CLASSES (Öğretmen Sınıfları)
CREATE TABLE public.teacher_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  students JSONB DEFAULT '[]'::jsonb, -- Takip edilen öğrencilerin listesi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 3. STORAGE (Dosya Depolama)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 4. ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- RLS Aktifleştirme
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------
------------------------------------------------------------------------

-- Profil tablosunda herkesin KENDİ profilini silebilmesini sağla
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" 
ON profiles FOR DELETE 
USING (auth.uid() = id);

-- Öğretmenlerin kendi sınıflarını silebilmesini sağla
DROP POLICY IF EXISTS "Teachers can delete own classes" ON teacher_classes;
CREATE POLICY "Teachers can delete own classes" 
ON teacher_classes FOR DELETE 
USING (auth.uid() = teacher_id);
-------------------------------------------------------------------------
-------------------------------------------------------------------------

-- 4.1 PROFILES POLİTİKALARI
-- Herkes profilleri okuyabilir (Liderlik tablosu için)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

-- Kullanıcılar kendi profillerini oluşturabilir (Kayıt/Healing için kritik!)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Kullanıcılar sadece kendi profillerini güncelleyebilir
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4.2 ROOMS POLİTİKALARI
-- Giriş yapmış herkes odaları görebilir ve oluşturabilir
CREATE POLICY "Auth users can view rooms" 
ON public.rooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can create rooms" 
ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

-- Oyun akışı için herkes odayı güncelleyebilir (Puanlama, katılma vb.)
-- Not: Prodüksiyonda bu daha kısıtlı olabilir ama oyun akıcılığı için şimdilik açık bırakıyoruz.
CREATE POLICY "Auth users can update rooms" 
ON public.rooms FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Host can delete rooms" 
ON public.rooms FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- 4.3 CATEGORIES POLİTİKALARI
-- Herkes kategorileri görebilir
CREATE POLICY "Categories are viewable by everyone" 
ON public.categories FOR SELECT USING (true);

-- Sadece öğretmenler kategori oluşturabilir/düzenleyebilir
CREATE POLICY "Teachers can insert categories" 
ON public.categories FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);

CREATE POLICY "Owners can update categories" 
ON public.categories FOR UPDATE TO authenticated 
USING (auth.uid() = owner_id);

-- Sahiplerin kendi kategorilerini silebilmesini sağla
CREATE POLICY "Owners can delete their own categories"
ON public.categories FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- 4.4 TEACHER CLASSES POLİTİKALARI
-- Sadece sınıfın sahibi görebilir ve yönetebilir
CREATE POLICY "Teachers manage own classes" 
ON public.teacher_classes FOR ALL TO authenticated 
USING (auth.uid() = teacher_id);

------------------------------------------------------------------------
------------------------------------------------------------------------
-- Önce eski kısıtlayıcı politikaları temizleyelim (Çakışma olmasın diye)
DROP POLICY IF EXISTS "Teachers manage own classes" ON public.teacher_classes;
DROP POLICY IF EXISTS "Teachers can delete own classes" ON public.teacher_classes;

-- 1. YENİ POLİTİKA: Herkes sınıfları GÖREBİLİR (Öğrencilerin aramada bulması için şart)
CREATE POLICY "Everyone can view classes"
ON public.teacher_classes
FOR SELECT
TO authenticated
USING (true);

-- 2. YENİ POLİTİKA: Sadece Öğretmen kendi sınıfını DÜZENLEYEBİLİR/SİLEBİLİR
CREATE POLICY "Teachers can manage own classes"
ON public.teacher_classes
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

-- 4.5 STORAGE POLİTİKALARI
-- Avatar resimleri herkese açık
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

-- Giriş yapmış kullanıcılar avatar yükleyebilir
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
CREATE POLICY "Anyone can upload an avatar" 
ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 5. OTOMASYON (TRIGGERS & FUNCTIONS)
-- Yeni kullanıcı kaydolduğunda otomatik profil oluşturan fonksiyon
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, avatar_url, total_points, total_trophies)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'User_' || substr(new.id::text, 1, 6)),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    0,
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı bağla
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. REALTIME AYARLARI
-- Odalar tablosundaki değişiklikleri anlık dinlemek için
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- 7. SINIF ISTEK
create or replace function public.request_join_class(class_id uuid)
returns boolean language plpgsql security definer as $$
declare
  rows_updated int := 0;
begin
  update public.teacher_classes
  set students = students || jsonb_build_array(
    jsonb_build_object(
      'id', auth.uid()::text,
      'username', (select username from public.profiles where id = auth.uid())::text,
      'avatar_url', (select avatar_url from public.profiles where id = auth.uid())::text,
      'total_points', coalesce((select total_points from public.profiles where id = auth.uid()),0),
      'total_trophies', coalesce((select total_trophies from public.profiles where id = auth.uid()),0),
      'status', 'pending'
    )
  )
  where id = class_id
    and not exists (
      select 1 from jsonb_array_elements(students) elem
      where (elem ->> 'id') = auth.uid()::text
    );

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  return rows_updated > 0;
end;
$$;

grant execute on function public.request_join_class(uuid) to authenticated;

-- BAN SISTEMI
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_banned ON public.profiles (banned);

-- Güncellenmiş yeni kullanıcı oluşturma fonksiyonu (banned alanını da ekler)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
INSERT INTO public.profiles (id, username, role, avatar_url, total_points, total_trophies, banned)
VALUES (
new.id,
COALESCE(new.raw_user_meta_data->>'username', 'User_' || substr(new.id::text, 1, 6)),
COALESCE(new.raw_user_meta_data->>'role', 'student'),
COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
0,
0,
false
)
ON CONFLICT (id) DO NOTHING;
RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yönetici/öğretmen için güvenli ban fonksiyonu (ROLE kontrolü yapar ve oturumları siler)
CREATE OR REPLACE FUNCTION public.admin_ban_user(target_id uuid, is_banned boolean)
RETURNS void AS $$
BEGIN
IF current_setting('jwt.claims.role', true) IS NULL OR current_setting('jwt.claims.role', true) <> 'teacher' THEN
RAISE EXCEPTION 'only teachers may call admin_ban_user';
END IF;

UPDATE public.profiles SET banned = is_banned WHERE id = target_id;

IF is_banned THEN
IF to_regclass('auth.sessions') IS NOT NULL THEN
DELETE FROM auth.sessions WHERE user_id = target_id;
END IF;
IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
DELETE FROM auth.refresh_tokens WHERE user_id = target_id;
END IF;
END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) TO authenticated;

-- Realtime: profilleri de yayınla ki client anlık değişiklikleri alabilsin
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Örnek kullanımlar (SQL Editor veya server-side):
-- 1) Bir kullanıcıyı banlamak (teacher rolündeyken):
-- SELECT public.admin_ban_user('user-uuid-here'::uuid, true);
-- 2) Ban kaldırmak:
-- SELECT public.admin_ban_user('user-uuid-here'::uuid, false);

-- Öğretmenler ban alanını güncelleyebilsin
DROP POLICY IF EXISTS "Teachers can update banned" ON public.profiles;
CREATE POLICY "Teachers can update banned"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id OR
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'))
)
WITH CHECK (
  auth.uid() = id OR
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'))
);