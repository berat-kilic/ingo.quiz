import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'tr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LANG_STORAGE_KEY = 'ingo_language';

const translations = {
  en: {
    // giriş
    welcome: 'Welcome',
    loginTitle: 'Login',
    registerTitle: 'Register',
    roleSelect: 'Select Role',
    username: 'Username',
    password: 'Password',
    loginBtn: 'Login',
    registerBtn: 'Register',
    teacherKey: 'Teacher Approval Key',
    teacherKeyPlaceholder: 'Enter Key (e.g. INGO_MASTER)',
    switchToRegister: "Don't have an account? Register",
    switchToLogin: 'Already have an account? Login',
    selectAvatar: 'Select Avatar',
    fillAll: 'Please fill all required fields.',
    loggingIn: 'Logging in...',
    registering: 'Registering...',
    student: 'Student',
    teacher: 'Teacher',
    competitiveQuizArena: 'Competitive Quiz Arena',
    genericError: 'An error occurred.',

    // anasayfa
    leaderboard: 'Leaderboard',
    loadingLeaderboard: 'Loading leaderboard...',
    global: 'Global',
    createRoom: 'Create Room',
    createRoomDesc: 'Configure game settings',
    joinGame: 'Join Game',
    joinRoomDesc: 'Join an existing room code to compete.',
    enterCodePlaceholder: 'ENTER CODE',
    joinBtn: 'JOIN',
    settings: 'Settings',
    settingsDesc: 'Configure audio, language and profile.',
    selectCategory: 'Select Category',
    newCategory: '+ New Category',
    questionCount: 'Question Count',
    timePerQuestion: 'Time (Seconds)',
    cancel: 'Cancel',
    start: 'Start',
    noPlayersYet: 'No players yet.',
    creatingRoom: 'Creating Room...',
    joiningRoom: 'Joining...',
    notifications: 'Notifications',
    noNotifications: 'No new notifications',
    approve: 'Approve',
    reject: 'Reject',
    requestApproved: 'Request approved',
    requestRejected: 'Request rejected',
    editCategory: 'Edit Category',
    questionsCount: 'Questions',

    // katagori edit menü
    createCategory: 'New Category',
    categoryName: 'Category Name',
    gameMode: 'Game Mode',
    modeClassic: 'Classic (Typing)',
    modeMulti: 'Multiple Choice',
    modeDictionary: 'Load Dictionary',
    questionText: 'Question',
    answerText: 'Correct Answer (use / for alternatives)',
    wrongOption1: 'Wrong Option 1',
    wrongOption2: 'Wrong Option 2',
    wrongOption3: 'Wrong Option 3',
    addQuestion: 'Add',
    saveCategory: 'Save Category',
    newQuestion: 'New Question',
    dictionaryUpload: 'Dictionary Upload',
    dictionaryFormatHint: 'TXT format: each line "question:answer". Each line becomes a separate classic question.',
    dictionarySelectFile: 'Select .txt file',
    dictionaryReplaceFile: 'Replace file',
    dictionaryLoaded: 'Loaded: {name} ({count} questions)',
    dictionaryFileTypeError: 'Please select a .txt file.',
    dictionaryParseFailed: 'Dictionary file could not be read.',
    dictionarySomeLinesSkipped: '{count} lines were skipped due to invalid format.',
    dictionaryLoading: 'Reading file...',
    dictionaryPickLost: 'File selection was interrupted. Please select the file again.',
    dictionaryPasteLabel: 'Or paste the text below',
    dictionaryPastePlaceholder: 'question:answer (each line is a separate question)',
    dictionaryApplyPaste: 'Process Pasted Text',
    dictionaryPastedName: 'Pasted Text',

    // Lobi
    roomCode: 'Room Code',
    waitingForPlayers: 'Waiting for players to join...',
    playersConnected: 'Players connected',
    leaveRoom: 'Leave Room',
    startGame: 'Start Game',
    hostTag: 'HOST',
    closeRoom: 'Close Room',
    kickConfirm: 'Are you sure you want to kick this player?',
    banConfirm: 'WARNING: Are you sure you want to permanently ban this player?',
    kickTitle: 'Kick',
    banTitle: 'Ban',
    bannedLabel: 'Banned',
    pts: 'pts',

    // oyun ekranı
    live: 'LIVE',
    submitAnswer: 'Lock Answer',
    changeAnswer: 'Change Answer',
    typeAnswer: 'Type your answer...',
    answerLocked: 'Answer Selected',
    waitingForTime: 'Waiting for timer...',
    correct: 'Correct!',
    partialCorrect: 'Partially Correct',
    timeUp: 'Time Up!',
    closeEnough: 'Close Enough!',
    perfect: 'Perfect!',
    incorrect: 'Incorrect',
    similarityScore: 'Similarity',
    nextQuestion: 'Next Question',
    autoNextQuestion: 'Auto-advance',
    correctAnswerIs: 'Correct Answer',
    gameFinished: 'Game Finished!',
    finalResults: 'Final Results',
    gameRanking: 'Game Ranking',
    overallRanking: 'Overall Ranking',
    hostLabel: 'Host',
    score: 'Score',
    leaveGameTitle: 'Leave Room',
    noScoreYet: 'No score yet',
    hostExitGameWarning: 'The game has not finished. If you leave, all students will be removed and the room will close.',
    playerExitGameWarning: 'If you leave, points from this game will not be added to your profile. Are you sure?',

    // Profil ve sınıf
    back: 'Back',
    trophies: 'Trophies',
    points: 'Total Points',
    championshipsWon: 'Championships Won',
    careerPoints: 'Career Points',
    updateProfile: 'Update Profile',
    newPassword: 'New Password (Min 6 characters)',
    confirmPassword: 'Confirm Password',
    saveChanges: 'Save Changes',
    studentTracking: 'My Classes',
    addStudent: 'Add Student',
    searchStudentPlaceholder: 'Search student username...',
    noStudentsTracked: 'No students in this class.',
    studentNotFound: 'Student not found!',
    studentAdded: 'Student added.',
    alreadyTracked: 'Already in class.',
    classes: 'Classes',
    createClass: 'Create Class',
    className: 'Class Name',
    deleteClass: 'Delete Class',
    selectClass: 'Select a Class',
    findTeacher: 'Find Teacher',
    searchTeacherPlaceholder: 'Search by username...',
    teacherClasses: "Teacher's Classes",
    joinClass: 'Join Class',
    requestSent: 'Request sent.',
    requestFailed: 'Request could not be sent. Please try again.',
    alreadyJoined: 'Joined',
    myClasses: 'My Classes',
    noClassesFound: 'No classes found.',
    noJoinedClasses: 'No joined classes yet.',
    pending: 'Pending',
    classAlreadyExists: 'A class with this name already exists.',
    classCreateFailed: 'Class could not be created.',
    classDeleteFailed: 'Class could not be deleted.',
    classDeleteConfirm: 'Are you sure you want to delete this class and its student list?',
    bannedCannotBeAdded: 'This user is banned and cannot be added to the class.',
    removeStudentConfirm: 'Are you sure you want to remove this student from the class?',

    // Profil ayar menüsü
    selectImage: 'Select Image',
    randomAvatar: 'Random Avatar',
    min6CharsPlaceholder: 'Enter at least 6 characters',
    retypePasswordPlaceholder: 'Re-enter password',
    saveFailed: 'Save failed. Please try again.',
    saveFailedWithReason: 'Save failed',
    profileSettingsAccess: 'Access Profile Settings',
    profileSettingsPasswordPrompt: 'For security, enter your current password.',
    verify: 'Verify',

    // ayarlar
    preferences: 'Preferences',
    soundEffects: 'Sound Effects',
    music: 'Music',
    language: 'Language',
    dangerZone: 'Danger Zone',
    deleteAccount: 'Delete Account',
    deleteWarning: 'Once you delete your account, there is no going back.',
    deleteFailed: 'Could not delete. Please try again.',

    // rol
    role_student: 'Student',
    role_teacher: 'Teacher',

    // sistem
    loading: 'Loading...',
    noConnection: 'No Connection',
    connectionLost: 'Connection Lost',
    reconnectPrompt: 'Do you want to reconnect?',
    close: 'Close',
    reconnect: 'Reconnect',
    roomClosed: 'Room closed.',
    kickedByHost: 'You were removed by the room host.',

    // hatalar
    roomNotFound: 'Room not found!',
    gameAlreadyStarted: 'Game already started.',
    failedToJoinRoom: 'Failed to join room.',
    userNotLoggedIn: 'User not logged in.',
    sessionNotFound: 'Session not found.',
    accountDeleteIncomplete: 'Account could not be fully deleted.',
    passwordsDoNotMatch: 'Passwords do not match!',
    invalidCredentials: 'Invalid username or password.',
    userNotFound: 'User not found.',
    passwordRequired: 'Password is required.',
    teacherNotFound: 'Teacher not found.',
    banned: 'This user is banned.',
    bannedAccountMessage: 'This account is banned. Please contact an admin for recovery.',
    usernameAndPasswordRequired: 'Username and password are required.',
    invalidTeacherKey: 'Invalid teacher key!',
    usernameTaken: 'This username is already taken.',
    profileCreateFailed: 'Profile could not be created.',
  },
  tr: {
    // giriş
    welcome: 'Hoş geldiniz',
    loginTitle: 'Giriş Yap',
    registerTitle: 'Kayıt Ol',
    roleSelect: 'Rol Seçimi',
    username: 'Kullanıcı Adı',
    password: 'Şifre',
    loginBtn: 'Giriş Yap',
    registerBtn: 'Kayıt Ol',
    teacherKey: 'Öğretmen Onay Anahtarı',
    teacherKeyPlaceholder: 'Anahtarı Girin (örn: INGO_MASTER)',
    switchToRegister: 'Hesabın yok mu? Kayıt Ol',
    switchToLogin: 'Zaten hesabın var mı? Giriş Yap',
    selectAvatar: 'Avatar Seç',
    fillAll: 'Lütfen tüm zorunlu alanları doldurun.',
    loggingIn: 'Giriş yapılıyor...',
    registering: 'Kayıt yapılıyor...',
    student: 'Öğrenci',
    teacher: 'Öğretmen',
    competitiveQuizArena: 'Rekabetçi Quiz Arenası',
    genericError: 'Bir hata oluştu.',

    // Anasayfa
    leaderboard: 'Liderlik Tablosu',
    loadingLeaderboard: 'Tablo yükleniyor...',
    global: 'Genel',
    createRoom: 'Oda Kur',
    createRoomDesc: 'Oyun ayarlarını yapılandır',
    joinGame: 'Oyuna Katıl',
    joinRoomDesc: 'Yarışmak için mevcut bir oda koduna katıl.',
    enterCodePlaceholder: 'KOD GİR',
    joinBtn: 'KATIL',
    settings: 'Ayarlar',
    settingsDesc: 'Ses, dil ve hesap ayarlarını yapılandır.',
    selectCategory: 'Kategori Seç',
    newCategory: '+ Yeni Kategori',
    questionCount: 'Soru Sayısı',
    timePerQuestion: 'Süre (Saniye)',
    cancel: 'İptal',
    start: 'Başlat',
    noPlayersYet: 'Henüz oyuncu yok.',
    creatingRoom: 'Oda kuruluyor...',
    joiningRoom: 'Katılınıyor...',
    notifications: 'Bildirimler',
    noNotifications: 'Yeni bildirim yok',
    approve: 'Onayla',
    reject: 'Reddet',
    requestApproved: 'İstek onaylandı',
    requestRejected: 'İstek reddedildi',
    editCategory: 'Kategoriyi Düzenle',
    questionsCount: 'Soru',

    // Katagori edit menü
    createCategory: 'Yeni Kategori',
    categoryName: 'Kategori Adı',
    gameMode: 'Oyun Modu',
    modeClassic: 'Klasik (Yazmalı)',
    modeMulti: 'Çoktan Seçmeli',
    modeDictionary: 'Sözlük Yükle',
    questionText: 'Soru',
    answerText: 'Doğru Cevap (/ ile alternatif ekle)',
    wrongOption1: 'Yanlış Şık 1',
    wrongOption2: 'Yanlış Şık 2',
    wrongOption3: 'Yanlış Şık 3',
    addQuestion: 'Ekle',
    saveCategory: 'Kaydet',
    newQuestion: 'Yeni Soru',
    dictionaryUpload: 'Sözlük Yükle',
    dictionaryFormatHint: 'TXT formatı: her satır "soru:cevap". Her satır ayrı klasik soru olur.',
    dictionarySelectFile: '.txt dosyası seç',
    dictionaryReplaceFile: 'Dosyayı değiştir',
    dictionaryLoaded: 'Yüklendi: {name} ({count} soru)',
    dictionaryFileTypeError: 'Lütfen .txt dosyası seçin.',
    dictionaryParseFailed: 'Sözlük dosyası okunamadı.',
    dictionarySomeLinesSkipped: '{count} satır format hatası nedeniyle atlandı.',
    dictionaryLoading: 'Dosya okunuyor...',
    dictionaryPickLost: 'Dosya seçimi yarıda kaldı. Lütfen dosyayı tekrar seçin.',
    dictionaryPasteLabel: 'Veya aşağıya yapıştır',
    dictionaryPastePlaceholder: 'soru:cevap (her satır ayrı soru)',
    dictionaryApplyPaste: 'Yapıştırılan Metni İşle',
    dictionaryPastedName: 'Yapıştırılan Metin',

    // Lobi
    roomCode: 'Oda Kodu',
    waitingForPlayers: 'Oyuncuların katılması bekleniyor...',
    playersConnected: 'Oyuncu bağlı',
    leaveRoom: 'Odadan Ayrıl',
    startGame: 'Oyunu Başlat',
    hostTag: 'KURUCU',
    closeRoom: 'Odayı Kapat',
    kickConfirm: 'Bu oyuncuyu atmak istediğinize emin misiniz?',
    banConfirm: 'DİKKAT: Bu oyuncuyu kalıcı olarak engellemek istediğinize emin misiniz?',
    kickTitle: 'At',
    banTitle: 'Yasakla',
    bannedLabel: 'Yasaklı',
    pts: 'puan',

    // oyun ekranı
    live: 'CANLI',
    submitAnswer: 'Cevabı Kilitle',
    changeAnswer: 'Cevabı Değiştir',
    typeAnswer: 'Cevabını yaz...',
    answerLocked: 'Cevap Seçildi',
    waitingForTime: 'Süre bekleniyor...',
    correct: 'Doğru!',
    partialCorrect: 'Kısmen Doğru',
    timeUp: 'Süre Doldu!',
    closeEnough: 'Yaklaştın!',
    perfect: 'Mükemmel!',
    incorrect: 'Yanlış',
    similarityScore: 'Benzerlik',
    nextQuestion: 'Sıradaki Soru',
    autoNextQuestion: 'Oto geçiş',
    correctAnswerIs: 'Doğru Cevap',
    gameFinished: 'Oyun Bitti!',
    finalResults: 'Final Sonuçlar',
    gameRanking: 'Oyun Sıralaması',
    overallRanking: 'Genel Sıralama',
    hostLabel: 'Kurucu',
    score: 'Skor',
    leaveGameTitle: 'Odadan Ayrıl',
    noScoreYet: 'Henüz puan yok',
    hostExitGameWarning: 'Oyun henüz sona ermedi. Ayrılırsanız tüm öğrenciler atılır ve oda kapanır.',
    playerExitGameWarning: 'Ayrılırsanız bu oyundan kazandığınız puanlar profilinize eklenmez. Emin misiniz?',

    // Profil ve sınıf
    back: 'Geri',
    trophies: 'Kupalar',
    points: 'Toplam Puan',
    championshipsWon: 'Şampiyonluk',
    careerPoints: 'Kariyer Puanı',
    updateProfile: 'Profili Güncelle',
    newPassword: 'Yeni Şifre (En az 6 karakter)',
    confirmPassword: 'Şifreyi Onayla',
    saveChanges: 'Değişiklikleri Kaydet',
    studentTracking: 'Sınıflarım',
    addStudent: 'Öğrenci Ekle',
    searchStudentPlaceholder: 'Öğrenci kullanıcı adı...',
    noStudentsTracked: 'Bu sınıfta henüz öğrenci yok.',
    studentNotFound: 'Öğrenci bulunamadı!',
    studentAdded: 'Öğrenci eklendi.',
    alreadyTracked: 'Öğrenci zaten sınıfta.',
    classes: 'Sınıflar',
    createClass: 'Sınıf Oluştur',
    className: 'Sınıf Adı',
    deleteClass: 'Sınıfı Sil',
    selectClass: 'Bir Sınıf Seçin',
    findTeacher: 'Öğretmen Bul',
    searchTeacherPlaceholder: 'Kullanıcı adı ile ara...',
    teacherClasses: 'Öğretmenin Sınıfları',
    joinClass: 'Sınıfa Katıl',
    requestSent: 'İstek gönderildi.',
    requestFailed: 'İstek gönderilemedi. Lütfen tekrar deneyin.',
    alreadyJoined: 'Katıldı',
    myClasses: 'Sınıflarım',
    noClassesFound: 'Sınıf bulunamadı.',
    noJoinedClasses: 'Henüz katıldığınız sınıf yok.',
    pending: 'Beklemede',
    classAlreadyExists: 'Bu isimde bir sınıf zaten mevcut.',
    classCreateFailed: 'Sınıf oluşturulamadı.',
    classDeleteFailed: 'Sınıf silinemedi.',
    classDeleteConfirm: 'Bu sınıfı ve içindeki öğrenci listesini silmek istediğinize emin misiniz?',
    bannedCannotBeAdded: 'Bu kullanıcı banlı olduğu için sınıfa eklenemez.',
    removeStudentConfirm: 'Bu öğrenciyi sınıftan çıkarmak istediğinize emin misiniz?',

    // Profil ayar menüsü
    selectImage: 'Resim Seç',
    randomAvatar: 'Rastgele Avatar',
    min6CharsPlaceholder: 'En az 6 karakter girin',
    retypePasswordPlaceholder: 'Şifreyi tekrar girin',
    saveFailed: 'Kaydetme başarısız. Lütfen tekrar deneyin.',
    saveFailedWithReason: 'Kaydetme başarısız',
    profileSettingsAccess: 'Profil Ayarlarına Geçiş',
    profileSettingsPasswordPrompt: 'Güvenlik için mevcut şifrenizi girin.',
    verify: 'Doğrula',

    // Ayarlar
    preferences: 'Tercihler',
    soundEffects: 'Ses Efektleri',
    music: 'Müzik',
    language: 'Dil',
    dangerZone: 'Tehlikeli Bölge',
    deleteAccount: 'Hesabı Sil',
    deleteWarning: 'Hesabını sildikten sonra geri dönüş yoktur.',
    deleteFailed: 'Silinemedi. Lütfen tekrar deneyin.',

    // Rol
    role_student: 'Öğrenci',
    role_teacher: 'Öğretmen',

    // Sistem
    loading: 'Yükleniyor...',
    noConnection: 'Bağlantı Yok',
    connectionLost: 'Bağlantı Koptu',
    reconnectPrompt: 'Yeniden bağlanmak ister misiniz?',
    close: 'Kapat',
    reconnect: 'Yeniden Bağlan',
    roomClosed: 'Oda kapatıldı.',
    kickedByHost: 'Oda sahibi tarafından atıldınız.',

    // hatalar
    roomNotFound: 'Oda bulunamadı!',
    gameAlreadyStarted: 'Oyun zaten başladı.',
    failedToJoinRoom: 'Odaya katılım başarısız.',
    userNotLoggedIn: 'Kullanıcı girişi yok.',
    sessionNotFound: 'Oturum bulunamadı.',
    accountDeleteIncomplete: 'Hesap tam silinemedi.',
    passwordsDoNotMatch: 'Şifreler eşleşmiyor!',
    invalidCredentials: 'Hatalı kullanıcı adı veya şifre.',
    userNotFound: 'Kullanıcı bulunamadı.',
    passwordRequired: 'Şifre gerekli.',
    teacherNotFound: 'Öğretmen bulunamadı.',
    banned: 'Bu kullanıcı banlanmıştır.',
    bannedAccountMessage: 'Bu hesap banlanmıştır. Kurtarım için yöneticiyle iletişime geçin.',
    usernameAndPasswordRequired: 'Kullanıcı adı ve şifre zorunludur.',
    invalidTeacherKey: 'Geçersiz öğretmen anahtarı!',
    usernameTaken: 'Bu kullanıcı adı zaten alınmış.',
    profileCreateFailed: 'Profil oluşturulamadı.',
  },
} as const;

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'tr' || stored === 'en') return stored;
  } catch {

  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) {
    return 'tr';
  }
  return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, language);
    } catch {

    }
  }, [language]);

  const t = (key: string) => {
    const current = translations[language] as Record<string, string>;
    const fallback = translations.en as Record<string, string>;
    return current[key] || fallback[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

