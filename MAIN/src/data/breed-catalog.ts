// Static reference dataset of cattle breeds and their characteristics.
// Curated catalog used to power breed selectors and breed-info card on Recognition page.

export const breeds = [
  "Alambadi Cow",
  "Amritmahal Cow",
  "Banni Buffalo",
  "Bargur Cow",
  "Dangi Cow",
  "Deoni Cow",
  "Gir Cow",
  "Hallikar Cow",
  "Jaffrabadi Buffalo",
  "Kangayam Cow",
  "Kankrej Cow",
  "Kasaragod Cow",
  "Kenkatha Cow",
  "Kherigarh Cow",
  "Malnad Gidda",
  "Mehsana Buffalo",
  "Nagori Cow",
  "Nagpuri Buffalo",
  "Nili Ravi Buffalo",
  "Nimari Cow",
  "Pulikulam Cow",
  "Rathi Cow",
  "Sahiwal Cow",
  "Shurti Buffalo",
  "Tharparkar Cow",
  "Vechur Cow",
] as const;

export type Breed = (typeof breeds)[number];

export interface BreedMetadata {
  origin: string;
  avgMilkYield: string;
  characteristics: string;
  animalType?: string;
  lifespan?: string;
  primaryUse?: string;
  description?: string;
}

export const breedInfo: Record<string, BreedMetadata> = {
  Gir: {
    origin: "Gujarat, India",
    avgMilkYield: "6-10 L/day",
    characteristics: "Distinctive curved horns, hardy, heat-tolerant, good milk quality with high fat content",
    animalType: "Cow",
    lifespan: "12-15 years",
    primaryUse: "Dairy",
    description: "One of the principal dairy breeds of India. Highly heat tolerant with excellent disease resistance."
  },
  "Gir Cow": {
    origin: "Gujarat, India",
    avgMilkYield: "6-10 L/day",
    characteristics: "Distinctive curved horns, hardy, heat-tolerant, good milk quality with high fat content",
    animalType: "Cow",
    lifespan: "12-15 years",
    primaryUse: "Dairy",
    description: "One of the principal dairy breeds of India. Highly heat tolerant with excellent disease resistance."
  },
  Jersey: {
    origin: "Jersey, British Isles",
    avgMilkYield: "15-20 L/day",
    characteristics: "Small-framed, fawn-colored, excellent butter fat content, docile temperament",
    animalType: "Cow",
    lifespan: "14-16 years",
    primaryUse: "Dairy",
    description: "Docile dairy breed famous for high butterfat content in milk."
  },
  "Holstein Friesian": {
    origin: "Netherlands/Germany",
    avgMilkYield: "25-35 L/day",
    characteristics: "Large-framed, black and white markings, highest milk producer among all breeds",
    animalType: "Cow",
    lifespan: "12-14 years",
    primaryUse: "Dairy",
    description: "World's highest production dairy animal, recognizable by black-and-white patched coat."
  },
  Sahiwal: {
    origin: "Punjab, Pakistan/India",
    avgMilkYield: "8-12 L/day",
    characteristics: "Reddish-brown, tick-resistant, heat-tolerant, good for tropical climates",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dairy",
    description: "Premier zebu dairy breed of India and Pakistan, heat tolerant and resistant to parasites."
  },
  "Sahiwal Cow": {
    origin: "Punjab, Pakistan/India",
    avgMilkYield: "8-12 L/day",
    characteristics: "Reddish-brown, tick-resistant, heat-tolerant, good for tropical climates",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dairy",
    description: "Premier zebu dairy breed of India and Pakistan, heat tolerant and resistant to parasites."
  },
  Kankrej: {
    origin: "Gujarat/Rajasthan, India",
    avgMilkYield: "5-8 L/day",
    characteristics: "Silver-grey to steel grey, strong lyre-shaped horns, dual-purpose, fast trotting gait",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dual Purpose",
    description: "Large dual-purpose breed known for strong lyre horns and fast trotting gait."
  },
  Tharparkar: {
    origin: "Rajasthan, India / Sindh, Pakistan",
    avgMilkYield: "6-10 L/day",
    characteristics: "White to grey, hardy desert breed, excellent heat tolerance, among the best Indian zebu milkers",
    animalType: "Cow",
    lifespan: "18-20 years",
    primaryUse: "Dairy",
    description: "Hardy desert breed, white to light grey coat, adapted to extreme temperature variations."
  },
  Rathi: {
    origin: "Rajasthan, India",
    avgMilkYield: "6-8 L/day",
    characteristics: "Brown with white patches, one of the best dairy breeds of Rajasthan, adapted to arid conditions",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dairy",
    description: "Efficient feed conversion dairy breed from arid Rajasthan."
  },
  Deoni: {
    origin: "Maharashtra/Karnataka, India",
    avgMilkYield: "3-5 L/day",
    characteristics: "White with black or red spots, dual-purpose breed from the Deccan plateau, decent milk and draught capability",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dual Purpose",
    description: "Dual-purpose breed from Deccan plateau, white body with black/red spots on head and neck."
  },
  "Red Sindhi": {
    origin: "Sindh, Pakistan / Rajasthan, India",
    avgMilkYield: "8-10 L/day",
    characteristics: "Reddish coat, heat-tolerant, good dairy producer, adapted to arid and semi-arid regions",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dairy",
    description: "Deep red dairy breed adapted to high humidity and warm climates."
  },
  "Banni Buffalo": {
    origin: "Gujarat, India",
    avgMilkYield: "10-14 L/day",
    characteristics: "Jet black with white markings, sickle-shaped horns, night-grazing adaptation",
    animalType: "Buffalo",
    lifespan: "20-25 years",
    primaryUse: "Dairy",
    description: "High-yielding buffalo breed from Banni grasslands of Kutch, famous for high fat milk."
  },
  "Jaffrabadi Buffalo": {
    origin: "Gujarat, India",
    avgMilkYield: "8-12 L/day",
    characteristics: "Heavy massive downward curving horns, jet black coat, massive body frame",
    animalType: "Buffalo",
    lifespan: "20-25 years",
    primaryUse: "Dairy",
    description: "Heaviest Indian buffalo breed from Gir forests of Gujarat, excellent butterfat producer."
  },
  "Mehsana Buffalo": {
    origin: "Gujarat, India",
    avgMilkYield: "8-12 L/day",
    characteristics: "Black to brownish black, sickle horns curving upward, docile temperament",
    animalType: "Buffalo",
    lifespan: "20-25 years",
    primaryUse: "Dairy",
    description: "Cross-breed between Murrah and Surti buffaloes, valued for consistent high lactation."
  },
  "Nili ravi Buffalo": {
    origin: "Punjab, India / Pakistan",
    avgMilkYield: "8-14 L/day",
    characteristics: "Black with white wall eyes and white markings on legs and forehead, tightly curled horns",
    animalType: "Buffalo",
    lifespan: "20-25 years",
    primaryUse: "Dairy",
    description: "Premier dairy buffalo breed known for white facial markings and high milk yield."
  },
  "Malnad gidda": {
    origin: "Karnataka, India",
    avgMilkYield: "1-3 L/day",
    characteristics: "Small dwarf build, highly disease-resistant, adapted to heavy rainfall hilly terrain",
    animalType: "Cow",
    lifespan: "18-20 years",
    primaryUse: "Dairy (small-scale)",
    description: "Smallest indigenous cattle breed from Western Ghats, extremely hardy and resilient."
  },
  "Malnad gidda Cow": {
    origin: "Karnataka, India",
    avgMilkYield: "1-3 L/day",
    characteristics: "Small dwarf build, highly disease-resistant, adapted to heavy rainfall hilly terrain",
    animalType: "Cow",
    lifespan: "18-20 years",
    primaryUse: "Dairy (small-scale)",
    description: "Smallest indigenous cattle breed from Western Ghats, extremely hardy and resilient."
  },
  Indigenous: {
    origin: "Various regions, India",
    avgMilkYield: "5-8 L/day",
    characteristics: "Adapted to local conditions, drought-resistant, low maintenance, dual-purpose",
    animalType: "Cow",
    lifespan: "15-18 years",
    primaryUse: "Dual Purpose",
    description: "Native zebu cattle adapted to local climate and environment."
  },
};

export const getMatchedBreedInfo = (breedName: string): BreedMetadata | null => {
  if (!breedName) return null;

  // 1. Direct match
  if (breedInfo[breedName]) {
    return breedInfo[breedName];
  }

  const cleanTarget = breedName.toLowerCase().replace(/_|-/g, " ").replace(/\b(cow|buffalo|cattle|breed)\b/gi, "").trim();

  // 2. Normalized match
  for (const [key, info] of Object.entries(breedInfo)) {
    const cleanKey = key.toLowerCase().replace(/_|-/g, " ").replace(/\b(cow|buffalo|cattle|breed)\b/gi, "").trim();
    if (cleanKey === cleanTarget) {
      return info;
    }
  }

  // 3. Substring match
  for (const [key, info] of Object.entries(breedInfo)) {
    const cleanKey = key.toLowerCase().replace(/_|-/g, " ").replace(/\b(cow|buffalo|cattle|breed)\b/gi, "").trim();
    if (cleanTarget.includes(cleanKey) || cleanKey.includes(cleanTarget)) {
      return info;
    }
  }

  return null;
};
