// CM-02: rules that tag each movie with the quiz's genres, mood, attention, and
// intensity. TMDB doesn't provide mood, attention, or intensity, so these come
// from TMDB genres and keywords. A teammate spot-checks 50 random movies
// (scripts/spot-check.mts); if fewer than 40 look right, adjust the rules here
// and rerun the import with --retag.

export type Tags = {
  genres: string[];
  moods: string[];
  attention: "background" | "easy" | "absorbing";
  intensity: 1 | 2 | 3;
};

// TMDB genre name -> the quiz's 12 genres. Unlisted TMDB genres (TV Movie) are dropped.
const GENRE_MAP: Record<string, string[]> = {
  Action: ["Action"],
  Adventure: ["Adventure"],
  Animation: ["Animation"],
  Comedy: ["Comedy"],
  Crime: ["Thriller"],
  Documentary: ["Documentary"],
  Drama: ["Drama"],
  Family: [],
  Fantasy: ["Fantasy"],
  History: ["Drama"],
  Horror: ["Horror"],
  Music: ["Drama"],
  Mystery: ["Mystery"],
  Romance: ["Romance"],
  "Science Fiction": ["Sci-fi"],
  Thriller: ["Thriller"],
  War: ["Drama", "Action"],
  Western: ["Action", "Adventure"],
};

const has = (keywords: Set<string>, words: string[]) => words.some((w) => keywords.has(w));

const COMFORT_WORDS = ["feel-good", "friendship", "christmas", "holiday", "small town", "best friend", "found family", "heartwarming"];
const EMOTIONAL_WORDS = ["grief", "loss of loved one", "death", "terminal illness", "cancer", "tragedy", "dying and death", "tearjerker", "father son relationship", "mother daughter relationship"];
const SERIOUS_WORDS = ["dystopia", "based on true story", "biography", "politics", "social commentary", "philosophy", "racism", "corruption", "existentialism", "artificial intelligence (a.i.)"];
const ABSORBING_WORDS = ["nonlinear timeline", "twist ending", "plot twist", "psychological thriller", "time travel", "conspiracy", "unreliable narrator", "mind-bending"];
const INTENSE_WORDS = ["gore", "serial killer", "torture", "brutality", "graphic violence", "massacre", "slasher", "body horror", "home invasion"];

export function tagMovie(input: { tmdbGenres: string[]; keywords: string[]; runtime: number; rating: string }): Tags {
  const g = new Set(input.tmdbGenres);
  const k = new Set(input.keywords.map((w) => w.toLowerCase()));
  const genres = [...new Set(input.tmdbGenres.flatMap((name) => GENRE_MAP[name] ?? []))];

  const dark = g.has("Horror") || g.has("Thriller") || g.has("Crime");
  const family = g.has("Family") || g.has("Animation");

  const moods: string[] = [];
  if (g.has("Comedy") && !g.has("Horror")) moods.push("Light and funny");
  if ((family && !dark) || (g.has("Romance") && g.has("Comedy")) || has(k, COMFORT_WORDS)) moods.push("Comforting");
  if ((g.has("Drama") && !dark && !g.has("Comedy")) || g.has("Romance") || has(k, EMOTIONAL_WORDS)) moods.push("Emotional");
  if (dark || g.has("Mystery") || g.has("Action")) moods.push("Suspenseful");
  if (g.has("Documentary") || g.has("War") || g.has("History") || has(k, SERIOUS_WORDS)) moods.push("Serious and thought-provoking");
  if (moods.length === 0) moods.push(g.has("Adventure") ? "Suspenseful" : "Light and funny");

  let attention: Tags["attention"] = "easy";
  if (input.runtime >= 140 || g.has("Mystery") || g.has("Documentary") || g.has("History") || g.has("War") || has(k, ABSORBING_WORDS)) {
    attention = "absorbing";
  } else if ((g.has("Comedy") || family || g.has("Romance")) && !dark && !g.has("Drama") && input.runtime <= 110) {
    attention = "background";
  }

  let intensity: Tags["intensity"] = 2;
  if (g.has("Horror") || g.has("War") || has(k, INTENSE_WORDS) || (input.rating === "R" && (dark || g.has("Action")))) {
    intensity = 3;
  } else if (!dark && !g.has("Action") && (family || input.rating === "G" || input.rating === "PG" || (input.rating === "PG-13" && (g.has("Romance") || g.has("Comedy"))))) {
    intensity = 1;
  }

  return { genres, moods: [...new Set(moods)], attention, intensity };
}
