import React, { useState } from "react";
import { X, Camera, Star, Trash2, Heart, Images } from "lucide-react";
import { MemoryPhoto } from "../../types/pet";
import { sound } from "../../utils/audio";

interface MemoryAlbumModalProps {
  photos: MemoryPhoto[];
  maxPhotos: number;
  onTakeSnapshot: () => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const MemoryAlbumModal: React.FC<MemoryAlbumModalProps> = ({
  photos,
  maxPhotos,
  onTakeSnapshot,
  onToggleFavorite,
  onDelete,
  onClose,
}) => {
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = filter === "favorites" ? photos.filter((p) => p.favorite) : photos;
  const selected = selectedId ? photos.find((p) => p.id === selectedId) || null : null;
  const favCount = photos.filter((p) => p.favorite).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#FFF7ED] border border-amber-900/20 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-amber-950 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 via-pink-500 to-amber-400 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-2xl">
              <Images className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">📸 Memory Album</h2>
              <p className="text-[11px] text-white/90">
                {photos.length}/{maxPhotos} moments{favCount > 0 ? ` • ${favCount} ⭐ favorites` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playCameraShutter();
                onTakeSnapshot();
              }}
              className="px-3 py-2 rounded-xl text-xs font-black bg-white/20 hover:bg-white/30 transition flex items-center gap-1.5 cursor-pointer"
              title="Snap a new photo right now"
            >
              <Camera className="w-4 h-4" /> Snap!
            </button>
            <button onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/30 transition cursor-pointer" aria-label="Close album">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-4 pt-3 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
              filter === "all" ? "bg-[#386641] text-[#F2E8CF]" : "bg-amber-100 text-amber-900 hover:bg-amber-200"
            }`}
          >
            All ({photos.length})
          </button>
          <button
            onClick={() => setFilter("favorites")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer flex items-center gap-1 ${
              filter === "favorites" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-900 hover:bg-amber-200"
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Favorites ({favCount})
          </button>
        </div>

        {/* Scrollable gallery */}
        <div className="flex-1 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-3 py-10">
              <div className="text-5xl">{filter === "favorites" ? "⭐" : "📷"}</div>
              <p className="text-sm font-bold text-amber-900">
                {filter === "favorites"
                  ? "No favorites yet — tap the star on a photo you love!"
                  : "No memories yet — snap your first moment together!"}
              </p>
              {filter === "all" && (
                <button
                  onClick={() => {
                    sound.playCameraShutter();
                    onTakeSnapshot();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black shadow-lg transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Take a snapshot
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visible.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative rounded-2xl overflow-hidden border border-amber-200 bg-white shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => setSelectedId(photo.id)}
                >
                  <img src={photo.dataUrl} alt={`${photo.dogName} memory`} className="w-full aspect-[4/3] object-cover" loading="lazy" />
                  {photo.favorite && (
                    <span className="absolute top-1.5 left-1.5 p-1 rounded-full bg-amber-400 text-white shadow">
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </span>
                  )}
                  <div className="p-2">
                    <p className="text-[11px] font-black truncate">
                      {photo.dogName} • Lvl {photo.level}
                    </p>
                    <p className="text-[10px] text-amber-800/80 truncate">
                      {photo.emotionLabel} • {formatDate(photo.timestamp)}
                    </p>
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(photo.id);
                      }}
                      title={photo.favorite ? "Remove favorite" : "Mark favorite"}
                      className={`p-1.5 rounded-full shadow transition cursor-pointer ${
                        photo.favorite ? "bg-amber-400 text-white" : "bg-white/90 text-amber-600 hover:bg-white"
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${photo.favorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(photo.id);
                        if (selectedId === photo.id) setSelectedId(null);
                      }}
                      title="Delete photo"
                      className="p-1.5 rounded-full bg-white/90 text-red-600 hover:bg-red-50 shadow transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-white border-t border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0">
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-500" /> Snap anytime — photos stay on this device.
          </span>
          <button onClick={onClose} className="font-black hover:underline text-amber-950 cursor-pointer">
            Done
          </button>
        </div>

        {/* Lightbox */}
        {selected && (
          <div
            className="absolute inset-0 z-10 bg-black/85 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setSelectedId(null)}
          >
            <img
              src={selected.dataUrl}
              alt={`${selected.dogName} favorite moment`}
              className="max-w-full max-h-[70%] rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-3 text-white text-sm font-black">
              {selected.dogName} • Lvl {selected.level} • {selected.emotionLabel}
            </p>
            <p className="text-white/70 text-xs">{formatDate(selected.timestamp)}</p>
            <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onToggleFavorite(selected.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  selected.favorite ? "bg-amber-400 text-white" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <Star className={`w-4 h-4 ${selected.favorite ? "fill-current" : ""}`} />
                {selected.favorite ? "Favorited!" : "Favorite"}
              </button>
              <button
                onClick={() => {
                  onDelete(selected.id);
                  setSelectedId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-white/15 text-white hover:bg-red-600 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
