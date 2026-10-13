import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from "lucide-react";
import { translate, type LanguageId } from "../i18n/i18n";

export interface StoryPage {
  /** One short paragraph of the story. */
  text: string;
  /** A simple scene key the built-in illustrations know how to draw. */
  scene: string;
  /** Optional data-URL image from the generator. */
  image?: string;
}

export interface Story {
  title: string;
  pages: StoryPage[];
  mode: string;
}

/** The book is hard-capped: never more than ten pages. */
export const MAX_STORY_PAGES = 10;
/** Body text size, in px, as specified. */
export const STORY_FONT_SIZE = 32;

interface StoryBookProps {
  language: LanguageId;
  dogName: string;
  /** Pre-built story, if one was already fetched. */
  initialStory?: Story | null;
  onClose: () => void;
}

/**
 * The storybook that slides out in the cozy room: an illustrated tale about a
 * dog, at most ten pages, set in 32px type.
 */
export const StoryBook: React.FC<StoryBookProps> = ({
  language,
  dogName,
  initialStory,
  onClose,
}) => {
  const t = (key: string) => translate(language, key);
  const [story, setStory] = useState<Story | null>(initialStory ?? null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    try {
      const res = await fetch("/api/pet/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogName, language, maxPages: MAX_STORY_PAGES }),
      });
      if (!res.ok) throw new Error(`story request failed: ${res.status}`);
      const data = (await res.json()) as Story;
      setStory({
        title: data.title || "Happy",
        mode: data.mode || "local_engine",
        pages: (data.pages || []).slice(0, MAX_STORY_PAGES),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, [dogName, language]);

  // Fetch the first story on open.
  useEffect(() => {
    if (!initialStory) void generate();
  }, [initialStory, generate]);

  const pages = story?.pages ?? [];
  const current = pages[page];
  const atEnd = page >= pages.length - 1;

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-[#F2E8CF] rounded-3xl shadow-2xl overflow-hidden border-4 border-[#6B4B2A] flex flex-col max-h-[92vh]">
        {/* Book spine / header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#6B4B2A] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-[#E8C88A] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base truncate">
                {story?.title || t("storybook")}
              </h3>
              {story && (
                <p className="text-[10px] text-[#E8C88A] font-medium">
                  {t("page")} {Math.min(page + 1, pages.length)} / {pages.length}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/25 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Page */}
        <div className="relative flex-1 overflow-y-auto bg-[#FBF3E0] px-5 sm:px-10 py-6 sm:py-8 flex flex-col">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="w-8 h-8 text-[#6A994E] animate-spin" />
              <p className="font-black text-sm text-[#386641]">{t("generating")}</p>
            </div>
          )}

          {!loading && error && !current && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-sm font-bold text-[#BC4749]">{error}</p>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> {t("newStory")}
              </button>
            </div>
          )}

          {!loading && current && (
            <article key={page} className="animate-splash-pop">
              {/* Illustration */}
              <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-[#6B4B2A]/25 mb-6 bg-[#EFE2C6]">
                {current.image ? (
                  <img
                    src={current.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PageIllustration scene={current.scene} />
                )}
              </div>

              {/* Body text — 32px as specified */}
              <p
                className="font-medium text-[#2B1D12] leading-relaxed text-center"
                style={{ fontSize: STORY_FONT_SIZE }}
              >
                {current.text}
              </p>
            </article>
          )}
        </div>

        {/* Footer: page turns + regenerate */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#6B4B2A] text-[#F2E8CF]">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs transition-all cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("back")}
          </button>

          <button
            onClick={generate}
            disabled={loading}
            title={t("newStory")}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#A7C957]/25 hover:bg-[#A7C957]/40 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("newStory")}</span>
          </button>

          <button
            onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
            disabled={atEnd || loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs transition-all cursor-pointer active:scale-95"
          >
            {t("next")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Built-in page illustrations, keyed by the `scene` a story page asks for.
// ---------------------------------------------------------------------------

const SCENE_ART: Record<string, React.ReactElement> = {
  meadow: (
    <>
      <rect width="100%" height="100%" fill="#BFE0F0" />
      <circle cx="120" cy="52" r="30" fill="#F7D774" />
      <path d="M0 150 Q200 110 400 150 V220 H0 Z" fill="#7FB069" />
      <path d="M0 175 Q200 140 400 175 V220 H0 Z" fill="#6A994E" />
    </>
  ),
  forest: (
    <>
      <rect width="100%" height="100%" fill="#DFF0DC" />
      <g fill="#386641">
        <path d="M70 200 L95 90 L120 200 Z" />
        <path d="M150 200 L175 70 L200 200 Z" />
        <path d="M250 200 L275 100 L300 200 Z" />
        <path d="M330 200 L352 85 L374 200 Z" />
      </g>
      <rect y="195" width="100%" height="25" fill="#6A994E" />
    </>
  ),
  blanket: (
    <>
      <rect width="100%" height="100%" fill="#2B1D12" />
      <rect y="150" width="100%" height="70" fill="#5C3A1E" />
      <ellipse cx="200" cy="128" rx="62" ry="52" fill="#D9A05B" />
      <ellipse cx="170" cy="116" rx="9" ry="10" fill="#2A1A10" />
      <ellipse cx="230" cy="116" rx="9" ry="10" fill="#2A1A10" />
      <path d="M120 178 q80 -22 160 0 q8 30 0 42 q-80 16 -160 0 q-8 -12 0 -42 Z" fill="#7C5BA6" />
    </>
  ),
  milk: (
    <>
      <rect width="100%" height="100%" fill="#3B2A1B" />
      <ellipse cx="200" cy="170" rx="90" ry="26" fill="#6E8194" />
      <ellipse cx="200" cy="170" rx="78" ry="21" fill="#6B4226" />
      <ellipse cx="200" cy="60" rx="46" ry="42" fill="#D9A05B" />
      <path d="M170 96 q30 20 60 0" stroke="#8A5A44" strokeWidth="5" fill="none" strokeLinecap="round" />
    </>
  ),
  night: (
    <>
      <rect width="100%" fill="#1E1B4B" height="100%" />
      <circle cx="320" cy="58" r="28" fill="#F7E7B0" />
      <g fill="#F7E7B0" opacity="0.9">
        <circle cx="70" cy="40" r="3" />
        <circle cx="150" cy="70" r="2.5" />
        <circle cx="240" cy="35" r="2" />
        <circle cx="110" cy="120" r="2" />
      </g>
      <path d="M0 165 Q200 130 400 165 V220 H0 Z" fill="#2C2A63" />
    </>
  ),
  kitchen: (
    <>
      <rect width="100%" height="100%" fill="#F2E8CF" />
      <rect y="160" width="100%" height="60" fill="#D4A373" />
      <rect x="40" y="80" width="110" height="80" rx="6" fill="#F2E8CF" stroke="#6B4B2A" strokeWidth="4" />
      <circle cx="95" cy="120" r="18" fill="none" stroke="#6A994E" strokeWidth="5" />
      <ellipse cx="290" cy="160" rx="52" ry="16" fill="#8FA3B8" />
    </>
  ),
  snow: (
    <>
      <rect width="100%" height="100%" fill="#DCEAFA" />
      <path d="M0 150 Q200 115 400 150 V220 H0 Z" fill="#F4F9FF" />
      <g fill="#fff" opacity="0.95">
        <circle cx="80" cy="60" r="6" />
        <circle cx="180" cy="95" r="5" />
        <circle cx="300" cy="50" r="7" />
        <circle cx="250" cy="120" r="4" />
      </g>
      <ellipse cx="200" cy="170" rx="46" ry="34" fill="#D9A05B" />
    </>
  ),
  park: (
    <>
      <rect width="100%" height="100%" fill="#CDE7F5" />
      <path d="M0 155 Q200 120 400 155 V220 H0 Z" fill="#7FB069" />
      <g>
        <rect x="180" y="80" width="8" height="80" fill="#854D0E" />
        <circle cx="184" cy="72" r="42" fill="#386641" />
      </g>
      <ellipse cx="90" cy="180" rx="26" ry="18" fill="#D9A05B" />
    </>
  ),
};

const FALLBACK_SCENE: React.ReactElement = (
  <>
    <rect width="100%" height="100%" fill="#EFE2C6" />
    <path d="M0 170 Q200 130 400 170 V220 H0 Z" fill="#A7C957" opacity="0.5" />
  </>
);

const PageIllustration: React.FC<{ scene: string }> = ({ scene }) => (
  <svg viewBox="0 0 400 220" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
    {SCENE_ART[scene] ?? FALLBACK_SCENE}
  </svg>
);
