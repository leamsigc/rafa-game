export type Region = "europe" | "northAmerica" | "asia" | "africa";

export type LanguageId =
  | "en-GB" | "es-ES" | "fr-FR" | "de-DE" | "it-IT" | "pt-PT" | "pl-PL" | "ru-RU" | "el-GR" | "sv-SE"
  | "en-US" | "es-MX" | "fr-CA"
  | "ja-JP" | "ko-KR" | "zh-CN" | "hi-IN" | "bn-BD" | "th-TH" | "vi-VN" | "id-ID"
  | "sw-KE" | "zu-ZA" | "am-ET" | "ha-NG" | "yo-NG" | "af-ZA";

export interface LanguageDef {
  id: LanguageId;
  /** Name written in the language itself. */
  native: string;
  /** English name for the settings list. */
  english: string;
  region: Region;
  flag: string;
  /** Right-to-left scripts. */
  rtl?: boolean;
}

export const REGION_ORDER: Region[] = ["europe", "northAmerica", "asia", "africa"];

export const REGION_LABEL: Record<Region, string> = {
  europe: "Europe",
  northAmerica: "North America",
  asia: "Asia",
  africa: "Africa",
};

export const LANGUAGES: LanguageDef[] = [
  // ---- Europe ----
  { id: "en-GB", native: "English (UK)", english: "English — United Kingdom", region: "europe", flag: "🇬🇧" },
  { id: "es-ES", native: "Español (España)", english: "Spanish — Spain", region: "europe", flag: "🇪🇸" },
  { id: "fr-FR", native: "Français (France)", english: "French — France", region: "europe", flag: "🇫🇷" },
  { id: "de-DE", native: "Deutsch (Deutschland)", english: "German — Germany", region: "europe", flag: "🇩🇪" },
  { id: "it-IT", native: "Italiano (Italia)", english: "Italian — Italy", region: "europe", flag: "🇮🇹" },
  { id: "pt-PT", native: "Português (Portugal)", english: "Portuguese — Portugal", region: "europe", flag: "🇵🇹" },
  { id: "pl-PL", native: "Polski (Polska)", english: "Polish — Poland", region: "europe", flag: "🇵🇱" },
  { id: "ru-RU", native: "Русский", english: "Russian — Russia", region: "europe", flag: "🇷🇺" },
  { id: "el-GR", native: "Ελληνικά", english: "Greek — Greece", region: "europe", flag: "🇬🇷" },
  { id: "sv-SE", native: "Svenska (Sverige)", english: "Swedish — Sweden", region: "europe", flag: "🇸🇪" },
  // ---- North America ----
  { id: "en-US", native: "English (US)", english: "English — United States", region: "northAmerica", flag: "🇺🇸" },
  { id: "es-MX", native: "Español (México)", english: "Spanish — Mexico", region: "northAmerica", flag: "🇲🇽" },
  { id: "fr-CA", native: "Français (Canada)", english: "French — Canada", region: "northAmerica", flag: "🇨🇦" },
  // ---- Asia ----
  { id: "ja-JP", native: "日本語 (日本)", english: "Japanese — Japan", region: "asia", flag: "🇯🇵" },
  { id: "ko-KR", native: "한국어 (대한민국)", english: "Korean — South Korea", region: "asia", flag: "🇰🇷" },
  { id: "zh-CN", native: "简体中文 (中国)", english: "Chinese — Simplified", region: "asia", flag: "🇨🇳" },
  { id: "hi-IN", native: "हिन्दी (भारत)", english: "Hindi — India", region: "asia", flag: "🇮🇳" },
  { id: "bn-BD", native: "বাংলা (বাংলাদেশ)", english: "Bengali — Bangladesh", region: "asia", flag: "🇧🇩" },
  { id: "th-TH", native: "ไทย (ประเทศไทย)", english: "Thai — Thailand", region: "asia", flag: "🇹🇭" },
  { id: "vi-VN", native: "Tiếng Việt (Việt Nam)", english: "Vietnamese — Vietnam", region: "asia", flag: "🇻🇳" },
  { id: "id-ID", native: "Bahasa Indonesia", english: "Indonesian — Indonesia", region: "asia", flag: "🇮🇩" },
  // ---- Africa ----
  { id: "sw-KE", native: "Kiswahili (Kenya)", english: "Swahili — Kenya", region: "africa", flag: "🇰🇪" },
  { id: "zu-ZA", native: "isiZulu (iNingizimu)", english: "Zulu — South Africa", region: "africa", flag: "🇿🇦" },
  { id: "am-ET", native: "አማርኛ (ኢትዮጵያ)", english: "Amharic — Ethiopia", region: "africa", flag: "🇪🇹" },
  { id: "ha-NG", native: "Hausa (Najeriya)", english: "Hausa — Nigeria", region: "africa", flag: "🇳🇬" },
  { id: "yo-NG", native: "Yorùbá (Nàìjíríà)", english: "Yoruba — Nigeria", region: "africa", flag: "🇳🇬" },
  { id: "af-ZA", native: "Afrikaans (Suid-Afrika)", english: "Afrikaans — South Africa", region: "africa", flag: "🇿🇦" },
];

export const DEFAULT_LANGUAGE: LanguageId = "en-US";

const UI: Record<LanguageId, Record<string, string>> = {
  "en-US": {
    tagline: "your cozy companion",
    start: "Start",
    settings: "Settings",
    splashesTitle: "Happy says",
    language: "Language",
    languageSubtitle: "Choose the language Happy speaks",
    health: "Health",
    healthHealthy: "Feeling great",
    healthFair: "A little off",
    healthLow: "Feeling poorly",
    healthCritical: "Needs care",
    illness: "Illness",
    noIllness: "Happy is perfectly healthy!",
    medicine: "Medicine",
    giveMedicine: "Give medicine",
    feelingBetter: "Feeling better...",
    blanket: "Cozy blanket",
    chocolateMilk: "Chocolate milk",
    sip: "Sipping...",
    readStory: "Read a story",
    leaveCoziness: "Leave",
    storybook: "Storybook",
    page: "Page",
    newStory: "New story",
    generating: "Writing your story...",
    next: "Next",
    back: "Back",
    done: "Done",
  },
  "en-GB": {
    tagline: "your cosy companion", start: "Start", settings: "Settings", splashesTitle: "Happy says",
    language: "Language", languageSubtitle: "Choose the language Happy speaks",
    health: "Health", healthHealthy: "Feeling great", healthFair: "A bit off", healthLow: "Feeling poorly",
    healthCritical: "Needs care", illness: "Illness", noIllness: "Happy is perfectly healthy!",
    medicine: "Medicine", giveMedicine: "Give medicine", feelingBetter: "Feeling better...",
    blanket: "Cosy blanket", chocolateMilk: "Chocolate milk", sip: "Sipping...", readStory: "Read a story",
    leaveCoziness: "Leave", storybook: "Storybook", page: "Page", newStory: "New story",
    generating: "Writing your story...", next: "Next", back: "Back", done: "Done",
  },
  "es-ES": {
    tagline: "tu compañero acogedor", start: "Empezar", settings: "Ajustes", splashesTitle: "Happy dice",
    language: "Idioma", languageSubtitle: "Elige el idioma de Happy",
    health: "Salud", healthHealthy: "Se siente genial", healthFair: "Algo indispuesto", healthLow: "Se siente mal",
    healthCritical: "Necesita cuidados", illness: "Enfermedad", noIllness: "¡Happy está perfectamente sano!",
    medicine: "Medicina", giveMedicine: "Dar medicina", feelingBetter: "Mejorando...",
    blanket: "Manta acogedora", chocolateMilk: "Leche chocolate", sip: "Sorbiendo...", readStory: "Leer un cuento",
    leaveCoziness: "Salir", storybook: "Libro de cuentos", page: "Página", newStory: "Nuevo cuento",
    generating: "Escribiendo tu cuento...", next: "Siguiente", back: "Atrás", done: "Listo",
  },
  "es-MX": {
    tagline: "tu compañero acogedor", start: "Empezar", settings: "Ajustes", splashesTitle: "Happy dice",
    language: "Idioma", languageSubtitle: "Elige el idioma de Happy",
    health: "Salud", healthHealthy: "Se siente genial", healthFair: "Algo indispuesto", healthLow: "Se siente mal",
    healthCritical: "Necesita cuidados", illness: "Enfermedad", noIllness: "¡Happy está bien sanito!",
    medicine: "Medicina", giveMedicine: "Dar medicina", feelingBetter: "Mejorando...",
    blanket: "Manta acogedora", chocolateMilk: "Lechita de chocolate", sip: "Sorbiendo...", readStory: "Leer un cuento",
    leaveCoziness: "Salir", storybook: "Libro de cuentos", page: "Página", newStory: "Nuevo cuento",
    generating: "Escribiendo tu cuento...", next: "Siguiente", back: "Atrás", done: "Listo",
  },
  "fr-FR": {
    tagline: "votre compagnon douillet", start: "Jouer", settings: "Réglages", splashesTitle: "Happy dit",
    language: "Langue", languageSubtitle: "Choisissez la langue de Happy",
    health: "Santé", healthHealthy: "Se sent très bien", healthFair: "Un peu paty", healthLow: "Se sent mal",
    healthCritical: "A besoin de soins", illness: "Maladie", noIllness: "Happy est en pleine forme !",
    medicine: "Médecine", giveMedicine: "Donner un médicament", feelingBetter: "Ça va mieux...",
    blanket: "Couverture douillette", chocolateMilk: "Lait au chocolat", sip: "Soupe bruyamment...",
    readStory: "Lire une histoire", leaveCoziness: "Sortir", storybook: "Livre d'histoires", page: "Page",
    newStory: "Nouvelle histoire", generating: "Écriture de votre histoire...", next: "Suivant", back: "Retour", done: "Terminé",
  },
  "fr-CA": {
    tagline: "votre compagnon douillet", start: "Jouer", settings: "Réglages", splashesTitle: "Happy dit",
    language: "Langue", languageSubtitle: "Choisissez la langue de Happy",
    health: "Santé", healthHealthy: "Se sent très bien", healthFair: "Un peu paty", healthLow: "Se sent mal",
    healthCritical: "A besoin de soins", illness: "Maladie", noIllness: "Happy est en pleine forme !",
    medicine: "Médecine", giveMedicine: "Donner un médicament", feelingBetter: "Ça va mieux...",
    blanket: "Couverture douillette", chocolateMilk: "Lait au chocolat", sip: "Soupe bruyamment...",
    readStory: "Lire une histoire", leaveCoziness: "Sortir", storybook: "Livre d'histoires", page: "Page",
    newStory: "Nouvelle histoire", generating: "Écriture de votre histoire...", next: "Suivant", back: "Retour", done: "Terminé",
  },
  "de-DE": {
    tagline: "dein gemütlicher Begleiter", start: "Starten", settings: "Einstellungen", splashesTitle: "Happy sagt",
    language: "Sprache", languageSubtitle: "Wähle die Sprache von Happy",
    health: "Gesundheit", healthHealthy: "Fühlt sich super", healthFair: "Etwas schlapp", healthLow: "Fühlt sich krank",
    healthCritical: "Braucht Pflege", illness: "Krankheit", noIllness: "Happy ist völlig gesund!",
    medicine: "Medizin", giveMedicine: "Medizin geben", feelingBetter: "Geht es besser...",
    blanket: "Gemütliche Decke", chocolateMilk: "Schokomilch", sip: "Schlürft...", readStory: "Eine Geschichte lesen",
    leaveCoziness: "Verlassen", storybook: "Bilderbuch", page: "Seite", newStory: "Neue Geschichte",
    generating: "Schreibe deine Geschichte...", next: "Weiter", back: "Zurück", done: "Fertig",
  },
  "it-IT": {
    tagline: "il tuo compagno coccoloso", start: "Gioca", settings: "Impostazioni", splashesTitle: "Happy dice",
    language: "Lingua", languageSubtitle: "Scegli la lingua di Happy",
    health: "Salute", healthHealthy: "Si sente benissimo", healthFair: "Un po' giù", healthLow: "Si sente male",
    healthCritical: "Ha bisogno di cure", illness: "Malattia", noIllness: "Happy è perfettamente sano!",
    medicine: "Medicina", giveMedicine: "Dare la medicina", feelingBetter: "Sta migliorando...",
    blanket: "Coperta coccolosa", chocolateMilk: "Latte al cioccolato", sip: "Sorseggia...", readStory: "Leggi una storia",
    leaveCoziness: "Esci", storybook: "Libro di fiabe", page: "Pagina", newStory: "Nuova storia",
    generating: "Sto scrivendo la storia...", next: "Avanti", back: "Indietro", done: "Fatto",
  },
  "pt-PT": {
    tagline: "o teu companheiro aconchegante", start: "Começar", settings: "Definições", splashesTitle: "O Happy diz",
    language: "Idioma", languageSubtitle: "Escolhe o idioma do Happy",
    health: "Saúde", healthHealthy: "Sente-se ótimo", healthFair: "Um bocado em baixo", healthLow: "Sente-se mal",
    healthCritical: "Precisa de cuidados", illness: "Doença", noIllness: "O Happy está perfeitamente saudável!",
    medicine: "Medicamento", giveMedicine: "Dar medicamento", feelingBetter: "A melhorar...",
    blanket: "Manta aconchegante", chocolateMilk: "Leite de chocolate", sip: "A sorver...", readStory: "Ler uma história",
    leaveCoziness: "Sair", storybook: "Livro de histórias", page: "Página", newStory: "Nova história",
    generating: "A escrever a tua história...", next: "Seguinte", back: "Voltar", done: "Concluído",
  },
  "pl-PL": {
    tagline: "twój przytulny towarzysz", start: "Start", settings: "Ustawienia", splashesTitle: "Happy mówi",
    language: "Język", languageSubtitle: "Wybierz język, którym mówi Happy",
    health: "Zdrowie", healthHealthy: "Czuje się świetnie", healthFair: "Trochę słabo", healthLow: "Czuje się źle",
    healthCritical: "Potrzebuje opieki", illness: "Choroba", noIllness: "Happy jest całkiem zdrowy!",
    medicine: "Lekarstwo", giveMedicine: "Podaj lekarstwo", feelingBetter: "Robi się lepiej...",
    blanket: "Przytulny koc", chocolateMilk: "Mleko czekoladowe", sip: "Siorpie...", readStory: "Przeczytaj bajkę",
    leaveCoziness: "Wyjdź", storybook: "Książka z bajkami", page: "Strona", newStory: "Nowa bajka",
    generating: "Piszę twoją bajkę...", next: "Dalej", back: "Wstecz", done: "Gotowe",
  },
  "ru-RU": {
    tagline: "твой уютный друг", start: "Играть", settings: "Настройки", splashesTitle: "Хэппи говорит",
    language: "Язык", languageSubtitle: "Выбери язык Хэппи",
    health: "Здоровье", healthHealthy: "Чувствует себя отлично", healthFair: "Чуть неважно", healthLow: "Чувствует себя плохо",
    healthCritical: "Нужна помощь", illness: "Болезнь", noIllness: "Хэппи полностью здоров!",
    medicine: "Лекарство", giveMedicine: "Дать лекарство", feelingBetter: "Станет лучше...",
    blanket: "Уютное одеяло", chocolateMilk: "Шоколадное молоко", sip: "Пьёт маленькими глотками...",
    readStory: "Читать сказку", leaveCoziness: "Выйти", storybook: "Книга сказок", page: "Страница", newStory: "Новая сказка",
    generating: "Пишу твою сказку...", next: "Далее", back: "Назад", done: "Готово",
  },
  "el-GR": {
    tagline: "ο σύντροφός σου που σε αγκαλιάζει", start: "Έναρξη", settings: "Ρυθμίσεις", splashesTitle: "Ο Χάπι λέει",
    language: "Γλώσσα", languageSubtitle: "Διάλεξε τη γλώσσα του Χάπι",
    health: "Υγεία", healthHealthy: "Αισθάνεται τέλεια", healthFair: "Λίγο άσκοπος", healthLow: "Αισθάνεται άσχημα",
    healthCritical: "Χρειάζεται φροντίδα", illness: "Ασθένεια", noIllness: "Ο Χάπι είναι απόλυτα υγιής!",
    medicine: "Φάρμακο", giveMedicine: "Δώσε φάρμακο", feelingBetter: "Γίνεται καλύτερα...",
    blanket: "Απαλή κουβέρτα", chocolateMilk: "Σοκολατένιο γάλα", sip: "Γλείφει...", readStory: "Διάβασε μια ιστορία",
    leaveCoziness: "Έξοδος", storybook: "Βιβλίο με ιστορίες", page: "Σελίδα", newStory: "Νέα ιστορία",
    generating: "Γράφω την ιστορία σου...", next: "Επόμενο", back: "Πίσω", done: "Τέλος",
  },
  "sv-SE": {
    tagline: "din mysiga följeslagare", start: "Starta", settings: "Inställningar", splashesTitle: "Happy säger",
    language: "Språk", languageSubtitle: "Välj språket Happy pratar",
    health: "Hälsa", healthHealthy: "Mår utmärkt", healthFair: "Lite trött", healthLow: "Mår dåligt",
    healthCritical: "Behöver omvårdnad", illness: "Sjukdom", noIllness: "Happy är helt frisk!",
    medicine: "Medicin", giveMedicine: "Ge medicin", feelingBetter: "Mår bättre...",
    blanket: "Mysig filt", chocolateMilk: "Chokladadryck", sip: "Sippar...", readStory: "Läs en saga",
    leaveCoziness: "Lämna", storybook: "Sagobok", page: "Sida", newStory: "Ny saga",
    generating: "Skriver din saga...", next: "Nästa", back: "Tillbaka", done: "Klar",
  },
  "ja-JP": {
    tagline: "温かいおともだち", start: "スタート", settings: "設定", splashesTitle: "ハピーのひとこと",
    language: "言語", languageSubtitle: "ハピーが話す言語を選んでね",
    health: "健康", healthHealthy: "とても元気", healthFair: "少し不就是", healthLow: "体調悪い",
    healthCritical: "看病が必要", illness: "病気", noIllness: "ハピーは元気満点！",
    medicine: "薬", giveMedicine: "薬を与える", feelingBetter: "だんだん回復中...",
    blanket: "あったかブランケット", chocolateMilk: "チョコミルク", sip: "ちゅーぷちゅーぷ...", readStory: "物語を読む",
    leaveCoziness: "出る", storybook: "えほん", page: "ページ", newStory: "新しい物語",
    generating: "物語をかいています...", next: "次へ", back: "もどる", done: "完了",
  },
  "ko-KR": {
    tagline: "따뜻한 친구", start: "시작", settings: "설정", splashesTitle: "해피의 한마디",
    language: "언어", languageSubtitle: "해피가 말할 언어를 고르세요",
    health: "건강", healthHealthy: "아주 건강해요", healthFair: "조금 안 좋아요", healthLow: "많이 아파요",
    healthCritical: "간호가 필요해요", illness: "질병", noIllness: "해피는 아주 건강해요!",
    medicine: "약", giveMedicine: "약 주기", feelingBetter: "나아지는 중...",
    blanket: "따뜻한 담요", chocolateMilk: "초코밀크", sip: "홀짝홀짝...", readStory: "이야기 읽기",
    leaveCoziness: "나가기", storybook: "그림책", page: "페이지", newStory: "새 이야기",
    generating: "이야기를 쓰는 중...", next: "다음", back: "뒤로", done: "완료",
  },
  "zh-CN": {
    tagline: "你温暖的伙伴", start: "开始", settings: "设置", splashesTitle: "欢欢说",
    language: "语言", languageSubtitle: "选择欢欢使用的语言",
    health: "健康", healthHealthy: "感觉很好", healthFair: "有点不舒服", healthLow: "很难受",
    healthCritical: "需要照顾", illness: "疾病", noIllness: "欢欢非常健康！",
    medicine: "药", giveMedicine: "喂药", feelingBetter: "正在好转...",
    blanket: "温暖的小毯子", chocolateMilk: "巧克力牛奶", sip: "一小口一小口地喝...", readStory: "读故事",
    leaveCoziness: "离开", storybook: "故事书", page: "第", newStory: "新故事",
    generating: "正在写你的故事...", next: "下一页", back: "返回", done: "完成",
  },
  "hi-IN": {
    tagline: "आपका प्यारा साथी", start: "शुरू करें", settings: "सेटिंग्स", splashesTitle: "हैप्पी कहता है",
    language: "भाषा", languageSubtitle: "हैप्पी की भाषा चुनें",
    health: "सेहत", healthHealthy: "बहुत अच्छा लग रहा है", healthFair: "थोड़ा कमज़ोर", healthLow: "बीमार लग रहा है",
    healthCritical: "देखभाल चाहिए", illness: "बीमारी", noIllness: "हैप्पी पूरी तरह स्वस्थ है!",
    medicine: "दवा", giveMedicine: "दवा दें", feelingBetter: "बेहतर हो रहा है...",
    blanket: "गर्म कंबल", chocolateMilk: "चॉकलेट मिल्क", sip: "घूँट-घूँट पी रहा है...", readStory: "कहानी पढ़ें",
    leaveCoziness: "बाहर", storybook: "कहानी की किताब", page: "पृष्ठ", newStory: "नई कहानी",
    generating: "आपकी कहानी लिखी जा रही है...", next: "आगे", back: "पीछे", done: "पूर्ण",
  },
  "bn-BD": {
    tagline: "আপনার আন্তরিক সঙ্গী", start: "শুরু করুন", settings: "সেটিংস", splashesTitle: "হ্যাপি বলছে",
    language: "ভাষা", languageSubtitle: "হ্যাপির ভাষা বেছে নিন",
    health: "স্বাস্থ্য", healthHealthy: "খুব ভালো লাগছে", healthFair: "একটু দুর্বল", healthLow: "অসুস্থ লাগছে",
    healthCritical: "যত্ন দরকার", illness: "রোগ", noIllness: "হ্যাপি একদম সুস্থ!",
    medicine: "ওষুধ", giveMedicine: "ওষুধ দিন", feelingBetter: "ভালো হচ্ছে...",
    blanket: "উষ্ণ কম্বল", chocolateMilk: "চকোলেট দুধ", sip: "অল্প অল্প করে পান করছে...", readStory: "গল্প পড়ুন",
    leaveCoziness: "বের হোন", storybook: "গল্পের বই", page: "পাতা", newStory: "নতুন গল্প",
    generating: "আপনার গল্প লেখা হচ্ছে...", next: "পরবর্তী", back: "পিছনে", done: "সম্পন্ন",
  },
  "th-TH": {
    tagline: "เพื่อนอบอุ่นของคุณ", start: "เริ่ม", settings: "ตั้งค่า", splashesTitle: "แฮปปี้บอกว่า",
    language: "ภาษา", languageSubtitle: "เลือกภาษาที่แฮปปี้พูด",
    health: "สุขภาพ", healthHealthy: "รู้สึกดีมาก", healthFair: "ไม่ค่อยสบาย", healthLow: "รู้สึกไม่ดี",
    healthCritical: "ต้องการการดูแล", illness: "โรค", noIllness: "แฮปปี้แข็งแรงมาก!",
    medicine: "ยา", giveMedicine: "ให้กินยา", feelingBetter: "กำลังดีขึ้น...",
    blanket: "ผ้าห่มอบอุ่น", chocolateMilk: "นมช็อกโกแลต", sip: "จิบทีละน้อย...", readStory: "อ่านเรื่องเล่า",
    leaveCoziness: "ออก", storybook: "หนังสือนิทย์", page: "หน้า", newStory: "เรื่องใหม่",
    generating: "กำลังเขียนเรื่องของคุณ...", next: "ถัดไป", back: "ย้อนกลับ", done: "เสร็จแล้ว",
  },
  "vi-VN": {
    tagline: "người bạn đồng hành ấm áp", start: "Bắt đầu", settings: "Cài đặt", splashesTitle: "Happy nói",
    language: "Ngôn ngữ", languageSubtitle: "Chọn ngôn ngữ Happy nói",
    health: "Sức khỏe", healthHealthy: "Khoẻ mạnh lắm", healthFair: "Hơi ốm", healthLow: "Cảm thấy không khỏe",
    healthCritical: "Cần được chăm sóc", illness: "Bệnh", noIllness: "Happy khoẻ mạnh hoàn toàn!",
    medicine: "Thuốc", giveMedicine: "Cho uống thuốc", feelingBetter: "Đang khỏe hơn...",
    blanket: "Chiếc chăn ấm", chocolateMilk: "Sữa sô cô la", sip: "Nhấp từng ngụm...", readStory: "Đọc câu chuyện",
    leaveCoziness: "Thoát", storybook: "Sách truyện", page: "Trang", newStory: "Câu chuyện mới",
    generating: "Đang viết câu chuyện của bạn...", next: "Tiếp", back: "Quay lại", done: "Xong",
  },
  "id-ID": {
    tagline: "teman Yatesi Anda", start: "Mulai", settings: "Pengaturan", splashesTitle: "Happy berkata",
    language: "Bahasa", languageSubtitle: "Pilih bahasa Happy berbicara",
    health: "Kesehatan", healthHealthy: "Merasa sangat baik", healthFair: "Agak kurang sehat", healthLow: "Merasa sakit",
    healthCritical: "Butuh perawatan", illness: "Penyakit", noIllness: "Happy sehat sepenuhnya!",
    medicine: "Obat", giveMedicine: "Beri obat", feelingBetter: "Makin baik...",
    blanket: "Selimut hangat", chocolateMilk: "Susu cokelat", sip: "Minum pelan-pelan...", readStory: "Baca cerita",
    leaveCoziness: "Keluar", storybook: "Buku cerita", page: "Halaman", newStory: "Cerita baru",
    generating: "Menulis cerita Anda...", next: "Lanjut", back: "Kembali", done: "Selesai",
  },
  "sw-KE": {
    tagline: "rafiki yako mwenye huruma", start: "Anza", settings: "Mipangilio", splashesTitle: "Happy anasema",
    language: "Lugha", languageSubtitle: "Chagua lugha inayozungumza Happy",
    health: "Afya", healthHealthy: "Ana hisi vizuri sana", healthFair: "Kidogo tu dhaifu", healthLow: "Ana hisi mgonjwa",
    healthCritical: "Anahitaji matunzo", illness: "Ugonjwa", noIllness: "Happy ana afya kamili!",
    medicine: "Dawa", giveMedicine: "Mpe dawa", feelingBetter: "Anaanza kuponya...",
    blanket: "Blanketi ya joto", chocolateMilk: "Maziwa ya chokolati", sip: "Anakunywa kwa vipande...",
    readStory: "Soma hadithi", leaveCoziness: "Toka", storybook: "Kitabu cha hadithi", page: "Ukurasa",
    newStory: "Hadithi mpya", generating: "Inaandika hadithi yako...", next: "Endelea", back: "Rudi", done: "Imekamilika",
  },
  "zu-ZA": {
    tagline: "umngani wakho othukile", start: "Qala", settings: "Izilungiselelo", splashesTitle: "Happy uthi",
    language: "Ulimi", languageSubtitle: "Khetha ulimi Happy ulukhuluma",
    health: "Impilo", healthHealthy: "Uzizwa kahle kakhulu", healthFair: "Uzizwa kancane", healthLow: "Uzizwa ugula",
    healthCritical: "Udinga ukunakekelwa", illness: "Ukugula", noIllness: "Happy uzinempilo ephelele!",
    medicine: "Umuthi", giveMedicine: "Mnika umuthi", feelingBetter: "Uyaphola...",
    blanket: "Ibhantshi elishayo", chocolateMilk: "Ubisi belokolishi", sip: "Uphuza kancane...",
    readStory: "Funda indaba", leaveCoziness: "Phuma", storybook: "Incwadi yendaba", page: "Ikhasi",
    newStory: "Indaba entsha", generating: "Iyabhala indaba yakho...", next: "Okulandelayo", back: "Emuva", done: "Kuphelile",
  },
  "am-ET": {
    tagline: "አገልጋይ ወዲያንትክር", start: "ጀምር", settings: "ቅንብሮች", splashesTitle: "ሀፒ ይላል",
    language: "ቋንቋ", languageSubtitle: "የሀፒን ቋንቋ ይምረጡ",
    health: "ጤና", healthHealthy: "በጣም ጥሩ ስሜታ ውስጥ", healthFair: "ትንሽ ደካማ ስሜታ", healthLow: "ህመም እየሰራ ነው",
    healthCritical: "ክብደት ያስፈልጋል", illness: "በሽታ", noIllness: "ሀፒ ሙሉ በሙሉ ጤናዊ ነው!",
    medicine: "መድኃኒት", giveMedicine: "መድኃኒት ይስጡ", feelingBetter: "ይጠሩ ነው...",
    blanket: "ሞቅ የሆነ ፍርስ", chocolateMilk: "የቸኮሌት ወተር", sip: "በትንሽ ትንሽ ይጠጣል...",
    readStory: "ታሪክ አንብብ", leaveCoziness: "ውጣ", storybook: "የታሪክ መጽሐፍ", page: "ገጽ",
    newStory: "አዲስ ታሪክ", generating: "ታሪክህን እየተጻፈ ነው...", next: "ቀጣይ", back: "ተመለስ", done: "ተጠናቅቷል",
  },
  "ha-NG": {
    tagline: "abokai yana da kwanci", start: "Fara", settings: "Saituna", splashesTitle: "Happy yana cewa",
    language: "Harshe", languageSubtitle: "Zaɗi harshen da Happy yake magana",
    health: "Lafiya", healthHealthy: "Yana jin daɗi sosai", healthFair: "Yana jin rashin kafi", healthLow: "Yana jin ciwon",
    healthCritical: "Yana buƙatar gaski", illness: "Cutacci", noIllness: "Happy yana cikin lafiya cikakke!",
    medicine: "Magani", giveMedicine: "Ba shi magani", feelingBetter: "Yana murmurewa...",
    blanket: "Bedding mai dumi", chocolateMilk: "Madara mai alfoci", sip: "Yana shanewa a sashi...",
    readStory: "Karanta labari", leaveCoziness: "Fita", storybook: "Tushen labari", page: "Shafi",
    newStory: "Sabuwar labari", generating: "Ana ƙirƙira labarinka...", next: "Na gaba", back: "Baya", done: "An kammala",
  },
  "yo-NG": {
    tagline: "ọ̀rẹ́ rẹ̀ tó ní ìtùlà", start: "Bẹ̀rẹ̀", settings: "Ètò", splashesTitle: "Happy ń sọ",
    language: "Èdè", languageSubtitle: "Yàn yan èdè tí Happy ń sọ",
    health: "Ilera", healthHealthy: "Ń rí i dára púpọ̀", healthFair: "Ń rí i kúkúrú", healthLow: "Ń rí i àìṣè",
    healthCritical: "O nílò ìtọ́jú", illness: "Àrùn", noIllness: "Happy ilera dáadáa púpọ̀!",
    medicine: "Oògùn", giveMedicine: "Fún un ní oògùn", feelingBetter: "Ń dára sí i...",
    blanket: "Bọ̀rà tí ó mú ìtùlà", chocolateMilk: "Owó síkó", sip: "Ń mí ni gbogbo ìrẹ̀...",
    readStory: "Ká ìtàn", leaveCoziness: "Jáde", storybook: "Ìwé ìtàn", page: "Ojú-ìwé",
    newStory: "Ìtàn tuntun", generating: "Ń kọ ìtàn rẹ...", next: "Tókàn", back: "Padà", done: "Ṣe",
  },
  "af-ZA": {
    tagline: "jou maat wat jy's", start: "Begin", settings: "Instellings", splashesTitle: "Happy sê",
    language: "Taal", languageSubtitle: "Kies die taal wat Happy praat",
    health: "Gesondheid", healthHealthy: "Voel wonderlik", healthFair: "Voel 'n bietjie swak", healthLow: "Voel siek",
    healthCritical: "Het sorg nodig", illness: "Siekte", noIllness: "Happy is heeltemal gesond!",
    medicine: "Medisyne", giveMedicine: "Gee medisyne", feelingBetter: "Word beter...",
    blanket: "Warm kombers", chocolateMilk: "Sjokolademelk", sip: "Sip slokke-vir-slokke...", readStory: "Lees 'n storie",
    leaveCoziness: "Uit", storybook: "Storieboek", page: "Bladsy", newStory: "Nuwe storie",
    generating: "Skryf jou storie...", next: "Volgende", back: "Terug", done: "Klaar",
  },
};

/** The rotating little splash bubbles on the title screen, keyed per language. */
const SPLASHES: Record<LanguageId, string[]> = {
  "en-US": ["Brush your teeth!", "Hello!", "Let's play!", "Good boy!", "Woof woof!", "I'm Happy!", "Snack time?", "Pet me!", "I love you", "Nap time..."],
  "en-GB": ["Brush your teeth!", "Hello!", "Let's play!", "Good boy!", "Woof woof!", "I'm Happy!", "Snack time?", "Pet me!", "I love you", "Nap time..."],
  "es-ES": ["¡Cepíllate los dientes!", "¡Hola!", "¡Jugamos!", "¡Buen chico!", "¡Guau guau!", "¡Soy Happy!", "¿Merienda?", "Acaríciame.", "Te quiero", "Hora de dormir..."],
  "es-MX": ["¡Cepíllate los dientes!", "¡Hola!", "¡Jugamos!", "¡Buenito!", "¡Guau guau!", "¡Soy Happy!", "¿Acomida?", "Acaríciame.", "Te quiero", "Hora de dormir..."],
  "fr-FR": ["Brosse-toi les dents !", "Bonjour !", "On joue !", "Bon garçon !", "Ouaf ouaf !", "Je suis Happy !", "Goûter ?", "Gratte-moi !", "Je t'aime", "Bonne sieste..."],
  "fr-CA": ["Brosse-toi les dents !", "Bonjour !", "On joue !", "Bon garçon !", "Ouaf ouaf !", "Je suis Happy !", "Goûter ?", "Gratte-moi !", "Je t'aime", "Bonne sieste..."],
  "de-DE": ["Zähne putzen!", "Hallo!", "Lass spielen!", "Brave Boy!", "Wuff wuff!", "Ich bin Happy!", "Snackzeit?", "Streichel mich!", "Ich lieb dich", "Schlafenszeit..."],
  "it-IT": ["Lavati i denti!", "Ciao!", "Giochiamo!", "Bravo cane!", "Bau bau!", "Sono Happy!", "Ora della merenda?", "Fammi le coccole.", "Ti amo", "Buonanotte..."],
  "pt-PT": ["Escova os dentes!", "Olá!", "Vamos brincar!", "Bomrapazinha!", "Ão ão!", "Sou o Happy!", "Hora do lanche?", "Faz-me festas.", "Gosto de ti", "Hora de dormir..."],
  "pl-PL": ["Umyj zęby!", "Cześć!", "Zabawmy się!", "Grzeczny piesek!", "Hau hau!", "Jestem Happy!", "Pora przekąski?", "Pogłaszcz mnie.", "Kocham cię", "Drzemka..."],
  "ru-RU": ["Почисти зубы!", "Привет!", "Давай играть!", "Хороший пёс!", "Гав-гав!", "Я — Хэппи!", "Перекус?", "Погладь меня.", "Я тебя люблю", "Спать..."],
  "el-GR": ["Βρύσε τα δόντια σου!", "Γεια σου!", "Παίξουμε!", "Καλό σκυλάκι!", "Γουβ γουβ!", "Είμαι ο Χάπι!", "Ώρα για σνακ;", "Χάδιασέ με.", "Σ' αγαπώ", "Ώρα για ύπνο..."],
  "sv-SE": ["Borsta tänderna!", "Hej!", "Låt oss leka!", "Duktig hund!", "Vov vov!", "Jag är Happy!", "Dags att äta?", "Klappa mig.", "Jag älskar dig", "Dags att sova..."],
  "ja-JP": ["歯磨きしなきゃ！", "こんにちは！", "遊ぼう！", "いい子だ！", "ワンワン！", "ハピーだよ！", "おやつ食べる？", "撫でて", "大好きだよ", "おねむ..."],
  "ko-KR": ["양치해!", "안녕!", "놀자!", "착한 강아지!", "멍멍!", "난 해피야!", "간식 먹을래?", "쓱쓱해 줘.", "사랑해", "잘 자..."],
  "zh-CN": ["要刷牙啦！", "你好！", "一起玩吧！", "好狗狗！", "汪汪！", "我是欢欢！", "要吃零食吗？", "摸摸我。", "我爱你", "睡觉觉..."],
  "hi-IN": ["ब्रश करो!", "नमस्ते!", "खेलते हैं!", "अच्छा लड़का!", "भौ-भौ!", "मैं हैप्पी हूँ!", "नाश्ता करें?", "मुझे सहलाओ।", "मैं तुमसे प्यार करता हूँ", "सोने का समय..."],
  "bn-BD": ["দাঁত মাজো!", "হ্যালো!", "খেলি!", "ভালো ছেলে!", "ওয়াওয়াও!", "আমি হ্যাপি!", "নাস্তা খাবে?", "আমাকে স্নেহ করো।", "আমি তোমাকে ভালোবাসি", "ঘুমানোর সময়..."],
  "th-TH": ["แปรงฟันสิ!", "สวัสดี!", "มาเล่นกัน!", "หมาดีจัง!", "ว้าว!", "ฉันชื่อแฮปปี้!", "กินขนมไหม?", "ลูบฉันหน่อย", "ฉันรักเธอ", "นอนแล้ว..."],
  "vi-VN": ["Hãy đánh răng đi!", "Xin chào!", "Chơi thôi!", "Cậu ngoan!", "Woof woof!", "Tớ là Happy!", "Ăn vặt nhé?", "Vuốt ve tớ.", "Tớ yêu bạn", "Đi ngủ thôi..."],
  "id-ID": ["Sikat gigi dulu!", "Halo!", "Ayo main!", "Anjing baik!", "Guk guk!", "Aku Happy!", "Makan ringan?", "Elus aku.", "Aku cinta kamu", "Waktunya tidur..."],
  "sw-KE": ["Brush nyuso zako!", "Habari!", "Tucheze!", "Mbwa mzuri!", "Bow bow!", "Mimi ni Happy!", "Chakula?"],
  "zu-ZA": ["Bhrusha amazinyu!", "Sawubona!", "Masithande!", "Inja enhle!", "Baw baw!", "Ngingi Happy!", "Ukudla?"],
  "am-ET": ["ጥርትህን አጽድ!", "ሰላም!", "እንጫወት!", "ጥሩ ወልድ!", "ውው!", "እኔ ሀፒ ነኝ!", "ምብር?"],
  "ha-NG": ["Kuma yanka!", "Sannu!", "Mu wasa!", "Karo mai kyau!", "Woof woof!", "Ni Happy ne!", "Abinci?"],
  "yo-NG": ["Jẹ́ o mọ ẹ̀n!", "Pẹ̀lẹ́ o!", "Ẹ Ṣeré!", "Ajọ ọwọ́!", "Wọ́wọ́!", "Ẹmi ni Happy!", "Oúnjẹ?"],
  "af-ZA": ["Bors jou tande!", "Hallo!", "Kom speel!", "Brave seuntjie!", "Blaf blaf!", "Ek is Happy!", "Knapie?"],
};

// Spanish/French Canadian variants reuse the base splash pool.
SPLASHES["fr-CA"] = SPLASHES["fr-FR"];
SPLASHES["en-GB"] = SPLASHES["en-US"];

export function getLanguage(id: LanguageId): LanguageDef {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === "string" && LANGUAGES.some((l) => l.id === value);
}

/** Translate a key; falls back to English, then to the key itself. */
export function translate(lang: LanguageId, key: string): string {
  return UI[lang]?.[key] ?? UI[DEFAULT_LANGUAGE]?.[key] ?? key;
}

export function getSplashes(lang: LanguageId): string[] {
  const pool = SPLASHES[lang];
  if (pool && pool.length >= 4) return pool;
  return SPLASHES[DEFAULT_LANGUAGE];
}

const STORAGE_KEY = "doghouse_language_v1";

export function loadLanguage(): LanguageId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isLanguageId(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(lang: LanguageId): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") {
    const def = getLanguage(lang);
    document.documentElement.lang = def.id;
    document.documentElement.dir = def.rtl ? "rtl" : "ltr";
  }
}
