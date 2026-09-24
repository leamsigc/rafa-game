/**
 * Secret chat codes — typed EXACTLY (case-sensitive, weird casing + numbers)
 * into the chat box to unlock hidden Easter eggs. They're deliberately tricky
 * so they can't be guessed by accident.
 */
export interface SecretCodeDef {
  id: string;
  /** Exact string the player must type (trimmed, case-sensitive). */
  code: string;
  title: string;
  /** The dog's theatrical response in the chat stream. */
  dogMessage: string;
  /** Easter-egg scene rendered by SecretCodeModal. */
  scene: "happyMeal" | "boneStorm" | "treatRain";
  rewardCoins: number;
}

export const SECRET_CODES: SecretCodeDef[] = [
  {
    id: "happy_meal",
    code: "HaPpY m3aL",
    title: "Happy Meal 🍔",
    scene: "happyMeal",
    rewardCoins: 15,
    dogMessage:
      "*eyes go wide, a mischievous trollish grin spreads across your furry face* Hehehe... you found the SECRET CODE! 🍔 *devours a whole Happy Meal like a tiny gremlin* NOM NOM NOM!",
  },
  {
    id: "bone_storm",
    code: "b0nE rUsH 99",
    title: "Bone Storm 🦴",
    scene: "boneStorm",
    rewardCoins: 25,
    dogMessage:
      "*howls with joy as the sky rains a thousand glowing bones* WOOF WOOF WOOOO! It's a BONE STORM! Best day EVER! 🦴🌀",
  },
  {
    id: "treat_rain",
    code: "tr34t m3 42",
    title: "Treat Rain 🍖",
    scene: "treatRain",
    rewardCoins: 20,
    dogMessage:
      "*opens mouth wide as steaks, biscuits and cheese tumble from the clouds* THE LEGENDARY TREAT RAIN! I shall catch them ALL! *zooms in circles* 🍖🧀🥓",
  },
];

/** Exact, case-sensitive match (input is trimmed but casing must be perfect). */
export function matchSecretCode(input: string): SecretCodeDef | null {
  const trimmed = input.trim();
  return SECRET_CODES.find((c) => c.code === trimmed) ?? null;
}
