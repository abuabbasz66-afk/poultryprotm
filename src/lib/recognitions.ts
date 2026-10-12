import nxtgenAward from "@/assets/nxtgen-2026-award.jpg.asset.json";

/** Verified recognitions only. Add new entries at the top; the first is featured. */
export interface Recognition {
  id: string;
  event: string;
  venue: string;
  date: string;
  recognition: string;
  founder: string;
  innovation: string;
  image: { src: string; alt: string; width: number; height: number };
  shareHeadline: string;
}

export const RECOGNITIONS: Recognition[] = [
  {
    id: "nxtgen-2026",
    event: "NXTGEN Innovation Challenge 2026 Grand Finale",
    venue: "ExCeL London, United Kingdom",
    date: "9 October 2026",
    recognition: "Grand Finale recognition for transformative innovation",
    founder: "Abubakar Sadiq Abbas",
    innovation: "PoultryPro, a digital poultry farm management platform",
    image: {
      src: nxtgenAward.url,
      alt: "Award plaque presented to Abubakar Sadiq Abbas congratulating him on making it to the Grand Finale of the NextGen Innovation Challenge 2026, in recognition of transformative innovation, resilience and commitment to shaping a better future.",
      width: 1080,
      height: 1920,
    },
    shareHeadline:
      "PoultryPro recognised at the NXTGEN Innovation Challenge 2026 Grand Finale in London.",
  },
];

export function shareLinks(headline: string, url = "https://poultrypro.life/#international-recognition") {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(headline);
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${headline} ${url}`)}`,
  };
}
