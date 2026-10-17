/**
 * Doggy Boutique catalogue — the single source of truth for wearable
 * accessories. These used to live in the 2D house shop; they are now sold
 * ONLY inside the 3D Clothing Boutique in the city.
 *
 * Every id here must also exist in `DogModel.buildAccessories()` so the
 * accessory can actually be rendered on Happy.
 */
export interface ClothingItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  category: "head" | "neck" | "body";
  description: string;
}

export const CLOTHING_CATALOG: ClothingItem[] = [
  {
    id: "bowtie",
    name: "Crimson Bowtie",
    icon: "🎀",
    price: 35,
    category: "neck",
    description: "A charming red satin bowtie for formal trot walks.",
  },
  {
    id: "sunglasses",
    name: "Cool Shades",
    icon: "🕶️",
    price: 45,
    category: "head",
    description: "Classic tinted UV sunglasses. 100% pure canine swagger.",
  },
  {
    id: "scarf",
    name: "Cozy Winter Scarf",
    icon: "🧣",
    price: 40,
    category: "neck",
    description: "A warm knit crimson scarf for breezy afternoon outings.",
  },
  {
    id: "bell",
    name: "Golden Jingle Bell",
    icon: "🔔",
    price: 25,
    category: "neck",
    description: "A polished brass bell that chimes gently on every step.",
  },
  {
    id: "tophat",
    name: "Aristocrat Top Hat",
    icon: "🎩",
    price: 65,
    category: "head",
    description: "A dapper black silk hat with a crimson ribbon.",
  },
  {
    id: "crown",
    name: "Royal Golden Crown",
    icon: "👑",
    price: 1000,
    category: "head",
    description: "A sparkling imperial crown studded with rubies and sapphires.",
  },
  {
    id: "witchhat",
    name: "Spooky Witch Hat",
    icon: "🧙",
    price: 55,
    category: "head",
    description: "A pointed purple witch hat. Granted free every Halloween season — or buy it early!",
  },
];

export function getClothingItem(id: string): ClothingItem | undefined {
  return CLOTHING_CATALOG.find((c) => c.id === id);
}
