import React from "react";

/**
 * Realistic ingredient artwork so forest finds look like themselves:
 * - Red Mushroom: spotted red cap + cream stem (not a generic emoji)
 * - Blueberries: midnight-blue berry cluster with leaf
 * - Golden Acorn: golden nut + textured cap (never an onion)
 * Other pantry items fall back to their emoji in a styled tile.
 */
export const IngredientIcon: React.FC<{ id: string; icon: string; size?: number }> = ({
  id,
  icon,
  size = 40,
}) => {
  if (id === "red_mushroom") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Red mushroom">
        <ellipse cx="24" cy="42" rx="10" ry="3" fill="#000" opacity="0.12" />
        <path d="M19 22 h10 l-1.5 16 a3 3 0 0 1 -3 2.6 h-1 a3 3 0 0 1 -3 -2.6 Z" fill="#f5e8d0" stroke="#d9c39a" strokeWidth="1.5" />
        <path d="M6 22 a18 14 0 0 1 36 0 c0 2.5 -2 4 -4.5 4 h-27 c-2.5 0 -4.5 -1.5 -4.5 -4 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
        <circle cx="15" cy="14" r="3.2" fill="#fff" />
        <circle cx="24" cy="10" r="2.4" fill="#fff" />
        <circle cx="32" cy="15" r="2.8" fill="#fff" />
        <circle cx="27" cy="19" r="1.6" fill="#fff" />
        <circle cx="19" cy="19" r="1.4" fill="#fff" />
        <ellipse cx="17" cy="12" rx="5" ry="2.4" fill="#fff" opacity="0.25" />
      </svg>
    );
  }
  if (id === "blueberry") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Blueberries">
        <ellipse cx="24" cy="42" rx="11" ry="3" fill="#000" opacity="0.12" />
        <path d="M24 12 C 26 7, 31 5, 36 6 C 34 10, 29 12, 24 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="1.2" />
        <circle cx="17" cy="26" r="8.5" fill="#3730a3" stroke="#1e1b4b" strokeWidth="1.5" />
        <circle cx="30" cy="28" r="9.5" fill="#4338ca" stroke="#1e1b4b" strokeWidth="1.5" />
        <circle cx="24" cy="18" r="7.5" fill="#4f46e5" stroke="#1e1b4b" strokeWidth="1.5" />
        <circle cx="14.5" cy="23.5" r="2.4" fill="#a5b4fc" opacity="0.9" />
        <circle cx="27" cy="25" r="2.8" fill="#a5b4fc" opacity="0.9" />
        <circle cx="22" cy="15.5" r="2" fill="#c7d2fe" opacity="0.9" />
        <circle cx="24" cy="18" r="2.2" fill="#1e1b4b" />
        <circle cx="17" cy="26" r="2" fill="#1e1b4b" />
        <circle cx="30" cy="28" r="2.2" fill="#1e1b4b" />
      </svg>
    );
  }
  if (id === "yellow_acorn") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Golden acorn">
        <ellipse cx="24" cy="42" rx="10" ry="3" fill="#000" opacity="0.12" />
        <path d="M24 6 c1.5 0 2 1.2 1.6 2.4" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M14 18 c0 -5 4.5 -8.5 10 -8.5 s10 3.5 10 8.5 c0 2 -1.5 3.2 -3.5 3.2 h-13 c-2 0 -3.5 -1.2 -3.5 -3.2 Z" fill="#a16207" stroke="#713f12" strokeWidth="1.5" />
        <path d="M15 15.5 h18 M16.5 18.5 h15" stroke="#713f12" strokeWidth="1" opacity="0.6" />
        <path d="M15.5 21.5 c0 8 3.5 14.5 8.5 17.5 c5 -3 8.5 -9.5 8.5 -17.5 Z" fill="#eab308" stroke="#a16207" strokeWidth="1.5" />
        <path d="M20 26 c-1 4 0.5 8 3 10.5" stroke="#fef9c3" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" fill="none" />
        <ellipse cx="24" cy="40.5" rx="2.4" ry="1.6" fill="#a16207" />
      </svg>
    );
  }
  return (
    <span style={{ fontSize: size * 0.75, lineHeight: 1 }} role="img" aria-label={id}>
      {icon}
    </span>
  );
};
