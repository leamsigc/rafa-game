import React from "react";
import { X, Download, Copy, Camera, Heart } from "lucide-react";
import { sound } from "../../utils/audio";

interface PhotoReviewModalProps {
  photoUrl: string;
  dogName: string;
  onSaveToAlbum?: () => void;
  onSnapAnother: () => void;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

/**
 * Instant photo review: save the high-res PNG to your device, copy it to
 * the clipboard, drop it into the Memory Album, or snap another moment.
 */
export const PhotoReviewModal: React.FC<PhotoReviewModalProps> = ({
  photoUrl,
  dogName,
  onSaveToAlbum,
  onSnapAnother,
  onClose,
  onToast,
}) => {
  const handleSaveToDevice = () => {
    try {
      const a = document.createElement("a");
      a.href = photoUrl;
      a.download = `${dogName.toLowerCase()}-${new Date().toISOString().slice(0, 10)}-photo.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      sound.playButtonTap();
      onToast?.(`📸 Saved ${dogName}'s photo to your device!`);
    } catch {
      onToast?.("Couldn't save — try the Copy button instead.");
    }
  };

  const handleCopy = async () => {
    try {
      const blob = await (await fetch(photoUrl)).blob();
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      sound.playButtonTap();
      onToast?.("📋 Photo copied to clipboard!");
    } catch {
      onToast?.("Clipboard blocked by the browser — use Save instead.");
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#F2E8CF] border-2 border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#A7C957]" />
            <h3 className="text-sm font-black text-white">Picture Perfect! 📸</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#2c5234] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* The shot */}
          <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg rotate-[-1deg] bg-black">
            <img src={photoUrl} alt={`${dogName} snapshot`} className="w-full block" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSaveToDevice}
              className="py-3 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <Download className="w-4 h-4" /> Save to Device
            </button>
            <button
              onClick={handleCopy}
              className="py-3 rounded-2xl bg-[#6A994E] hover:bg-[#5b8543] text-white font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <Copy className="w-4 h-4" /> Copy to Clipboard
            </button>
            {onSaveToAlbum && (
              <button
                onClick={() => { onSaveToAlbum(); onClose(); }}
                className="py-3 rounded-2xl bg-[#BC4749] hover:bg-[#a63a3c] text-white font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              >
                <Heart className="w-4 h-4 fill-current" /> Save to Memory Album
              </button>
            )}
            <button
              onClick={onSnapAnother}
              className="py-3 rounded-2xl bg-white border-2 border-[#386641]/25 text-[#386641] hover:bg-[#F2E8CF] font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <Camera className="w-4 h-4" /> Snap Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
