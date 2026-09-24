/**
 * Breed Discovery Journal — every breed your companion can discover as it
 * levels up, with trivia, origins, personality traits & fun facts.
 */
export interface BreedEntry {
  id: string;
  name: string;
  emoji: string;
  unlockLevel: number;
  origin: string;
  era: string;
  personality: string;
  funFact: string;
}

export const BREED_JOURNAL: BreedEntry[] = [
  {
    id: "golden",
    name: "Golden Retriever",
    emoji: "🦮",
    unlockLevel: 1,
    origin: "Scotland (Guisachan Estate)",
    era: "1860s",
    personality: "Gentle, eager-to-please and endlessly patient — the ultimate family dog.",
    funFact: "Golden Retrievers were originally bred to retrieve waterfowl without damaging it — hence their famously soft mouth!",
  },
  {
    id: "chocolate",
    name: "Chocolate Labrador",
    emoji: "🐕",
    unlockLevel: 2,
    origin: "Newfoundland, Canada",
    era: "1700s",
    personality: "Food-motivated goofball with a heart of gold and a nose for snacks.",
    funFact: "Labs have been America's favorite breed for over 30 years running — and chocolate pups get their rich coat from a recessive gene.",
  },
  {
    id: "husky",
    name: "Siberian Husky",
    emoji: "🐺",
    unlockLevel: 4,
    origin: "Northeast Asia (Chukchi people)",
    era: "Ancient lineage",
    personality: "Independent, mischievous escape artists who love to sing (awoo!).",
    funFact: "Huskies' double coat can keep them warm at -60°F / -51°C — and their blue eyes come from a special gene unrelated to coat color.",
  },
  {
    id: "dalmatian",
    name: "Dalmatian",
    emoji: "🐾",
    unlockLevel: 6,
    origin: "Croatia (Dalmatia coast)",
    era: "Documented since the 1600s",
    personality: "Athletic, alert coach dogs with boundless stamina and spotted style.",
    funFact: "Dalmatian puppies are born pure white — their famous spots only appear after about two weeks!",
  },
  {
    id: "corgi",
    name: "Pembroke Corgi",
    emoji: "🦊",
    unlockLevel: 8,
    origin: "Pembrokeshire, Wales",
    era: "1100s",
    personality: "Big-dog attitude in a short-legged package; herding instincts always on.",
    funFact: "Welsh legend says fairies rode Corgis into battle — those 'sock' markings are said to be saddle straps.",
  },
  {
    id: "shiba",
    name: "Shiba Inu",
    emoji: "🐕‍🦺",
    unlockLevel: 10,
    origin: "Japan (mountainous Chubu region)",
    era: "Ancient — over 2,000 years old",
    personality: "Cat-like, clean, dignified... until the famous 'Shiba scream' happens.",
    funFact: "The Shiba Inu is Japan's most popular breed and its name literally means 'brushwood dog'.",
  },
  {
    id: "border",
    name: "Border Collie",
    emoji: "🐕‍🦺",
    unlockLevel: 12,
    origin: "Anglo-Scottish border",
    era: "1700s",
    personality: "The smartest dog alive — needs a job or it will invent one.",
    funFact: "A Border Collie named Chaser learned over 1,000 object names — the largest vocabulary ever tested in a dog.",
  },
  {
    id: "bernese",
    name: "Bernese Mountain Dog",
    emoji: "🏔️",
    unlockLevel: 15,
    origin: "Swiss Alps (Bern canton)",
    era: "Roman mastiff descendants",
    personality: "Gentle alpine giants — calm, loyal, and drawn to children like magnets.",
    funFact: "Berners were farm dogs that pulled carts of milk to market — some still compete in carting trials today.",
  },
];

export function discoveredBreeds(level: number): BreedEntry[] {
  return BREED_JOURNAL.filter((b) => level >= b.unlockLevel);
}
