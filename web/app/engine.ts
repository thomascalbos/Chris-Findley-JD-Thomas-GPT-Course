import {
  GENRES, MOODS, MOVIES, RATINGS, serviceById,
  type Availability, type Genre, type Movie, type ServiceId,
} from "./movies";

// ---------- Questions ----------

export type QuestionKey = "occasion" | "genres" | "time" | "mood" | "ratings" | "minScore" | "era" | "attention";

// Every answer is stored as a list of option values; single-choice questions hold one value.
export type Answers = Partial<Record<QuestionKey, string[]>>;
export type MustKey = QuestionKey | "services";
export type Must = Partial<Record<MustKey, boolean>>;

type Question = {
  title: string;
  help?: string;
  multi?: number; // max selections for multi-choice questions
  exclusive?: string; // "any"-style option that clears the others
  options: { value: string; label: string }[];
};

export const CORE: QuestionKey[] = ["occasion", "genres", "time"];
export const MAX_FOLLOW_UPS = 4;

export const QUESTIONS: Record<QuestionKey, Question> = {
  occasion: {
    title: "What kind of night is it?",
    options: [
      { value: "solo", label: "Solo unwind" },
      { value: "date", label: "Date night" },
      { value: "background", label: "Background watch" },
      { value: "movienight", label: "Movie night" },
      { value: "surprise", label: "Surprise me" },
    ],
  },
  genres: {
    title: "What are you in the mood to watch?",
    help: "Pick up to three, or Anything.",
    multi: 3,
    exclusive: "any",
    options: [...GENRES.map((g) => ({ value: g, label: g })), { value: "any", label: "Anything" }],
  },
  time: {
    title: "How much time have you got?",
    options: [
      { value: "90", label: "Under 90 minutes" },
      { value: "120", label: "Under 2 hours" },
      { value: "150", label: "Under 2½ hours" },
      { value: "any", label: "Any length" },
    ],
  },
  mood: {
    title: "What should it feel like?",
    options: MOODS.map((m) => ({ value: m, label: m })),
  },
  ratings: {
    title: "Which content ratings are okay tonight?",
    help: "US ratings. This is a content limit, not a quality score.",
    multi: RATINGS.length,
    exclusive: "any",
    options: [...RATINGS.map((r) => ({ value: r, label: r })), { value: "any", label: "No preference" }],
  },
  minScore: {
    title: "Want a minimum audience score?",
    help: "Sample audience scores on a 1-to-5-star scale.",
    options: [
      { value: "any", label: "No minimum" },
      { value: "3", label: "3+ stars" },
      { value: "3.5", label: "3.5+ stars" },
      { value: "4", label: "4+ stars" },
    ],
  },
  era: {
    title: "Any particular era?",
    help: "Era boundaries are placeholders for this demo.",
    options: [
      { value: "recent", label: "Recent releases (2024+)" },
      { value: "last10", label: "Last 10 years (2016+)" },
      { value: "older", label: "Older favorites (before 2016)" },
      { value: "any", label: "Any era" },
    ],
  },
  attention: {
    title: "How much attention can you give it?",
    options: [
      { value: "background", label: "Background-friendly" },
      { value: "easy", label: "Easy to follow" },
      { value: "absorbing", label: "Fully absorbing" },
    ],
  },
};

export const optionLabel = (key: QuestionKey, value: string) =>
  QUESTIONS[key].options.find((o) => o.value === value)?.label ?? value;

export const isOpen = (values?: string[]) => !values?.length || values.includes("any");

export type Taste = {
  services: ServiceId[];
  favorites: string[];
  ratings: Record<string, number>; // imported Letterboxd ratings
  watchlist: string[];
  watched: string[];
};

export const hasTaste = (t: Taste) => t.favorites.length > 0 || Object.keys(t.ratings).length > 0 || t.watchlist.length > 0;

// Adaptive branching: ask only follow-ups the core answers and saved taste leave open, capped at four.
export function followUps(answers: Answers, taste: Taste): QuestionKey[] {
  const occasion = answers.occasion?.[0];
  const genres = answers.genres ?? [];
  const anyGenre = isOpen(genres);
  const pool: [QuestionKey, boolean][] = [
    ["mood", anyGenre || genres.length > 1 || occasion === "surprise"],
    ["attention", occasion !== "background"], // a background watch already answers this
    ["ratings", occasion === "date" || occasion === "movienight" || anyGenre || genres.some((g) => g === "Horror" || g === "Thriller")],
    ["era", anyGenre || occasion === "surprise" || occasion === "movienight"],
    ["minScore", !hasTaste(taste)], // saved favorites and ratings already signal a quality bar
  ];
  return pool.filter(([, ask]) => ask).map(([k]) => k).slice(0, MAX_FOLLOW_UPS);
}

// ---------- Availability ----------

export const fmtRuntime = (min: number) => `${Math.floor(min / 60)} h ${min % 60} min`;

const TYPE_LABEL = { subscription: "Included with subscription", free: "Free with ads", rent: "Rent or buy" } as const;
export const availabilityLabel = (a: Availability) => TYPE_LABEL[a.type];

// Best first: on the viewer's services, then included elsewhere, then free, then rental.
export function watchOptions(movie: Movie, services: ServiceId[]): Availability[] {
  const rank = (a: Availability) =>
    (services.includes(a.service) ? 0 : 10) + (a.type === "subscription" ? 0 : a.type === "free" ? 1 : 2);
  return [...movie.availability].sort((a, b) => rank(a) - rank(b));
}

export const onServices = (movie: Movie, services: ServiceId[]) =>
  movie.availability.some((a) => a.type !== "rent" && services.includes(a.service));

export const paidServices = (services: ServiceId[]) => services.filter((s) => !serviceById(s).free);

// Notify me only matters when the movie isn't already included with one of the viewer's paid services.
export const canNotify = (movie: Movie, services: ServiceId[]) =>
  !movie.availability.some((a) => a.type === "subscription" && paidServices(services).includes(a.service));

// ---------- Matching ----------

export type Adjustments = { avoidGenres: Genre[]; avoidMoods: string[]; maxIntensity?: number };
export const NO_ADJUSTMENTS: Adjustments = { avoidGenres: [], avoidMoods: [] };

type Criterion = { key: MustKey | "intensity"; weight: number; test: (m: Movie) => boolean; miss: (m: Movie) => string; bonus?: (m: Movie) => number };

const lower = (s: string) => s.toLowerCase();
const ERA_TEST: Record<string, (y: number) => boolean> = {
  recent: (y) => y >= 2024,
  last10: (y) => y >= 2016,
  older: (y) => y < 2016,
};

function criteria(answers: Answers, asked: QuestionKey[], services: ServiceId[], adj: Adjustments): Criterion[] {
  const out: Criterion[] = [];
  const val = (k: QuestionKey) => (asked.includes(k) && !isOpen(answers[k]) ? answers[k]! : null);

  const genres = val("genres");
  if (genres) out.push({
    key: "genres", weight: 8, test: (m) => m.genres.some((g) => genres.includes(g)),
    bonus: (m) => 1.5 * Math.max(0, m.genres.filter((g) => genres.includes(g)).length - 1), // covering more of the request fits better
    miss: (m) => `it's ${m.genres.map(lower).join(" and ")}, not ${genres.map(lower).join(" or ")}`,
  });
  const time = val("time");
  if (time) out.push({
    key: "time", weight: 5, test: (m) => m.runtime < Number(time[0]),
    miss: (m) => `it runs ${fmtRuntime(m.runtime)}, over your limit of ${lower(optionLabel("time", time[0]))}`,
  });
  const mood = val("mood");
  if (mood) out.push({
    key: "mood", weight: 3, test: (m) => m.moods.includes(mood[0] as Movie["moods"][number]),
    miss: (m) => `it's more ${lower(m.moods[0])} than ${lower(mood[0])}`,
  });
  const ratings = val("ratings");
  if (ratings) out.push({
    key: "ratings", weight: 3, test: (m) => ratings.includes(m.rating),
    miss: (m) => `it's rated ${m.rating}, outside the ratings you chose`,
  });
  const minScore = val("minScore");
  if (minScore) out.push({
    key: "minScore", weight: 2, test: (m) => m.score >= Number(minScore[0]),
    miss: (m) => `its sample audience score is ${m.score} of 5, under your ${minScore[0]}-star minimum`,
  });
  const era = val("era");
  if (era) out.push({
    key: "era", weight: 2, test: (m) => ERA_TEST[era[0]](m.year),
    miss: (m) => `it came out in ${m.year}, outside ${lower(optionLabel("era", era[0]))}`,
  });
  const attention = val("attention");
  if (attention) out.push({
    key: "attention", weight: 3, test: (m) => m.attention === attention[0],
    miss: (m) => `it's ${lower(optionLabel("attention", m.attention))} rather than ${lower(optionLabel("attention", attention[0]))}`,
  });
  if (services.length) out.push({
    key: "services", weight: 4, test: (m) => onServices(m, services),
    miss: () => "it isn't included or free on your selected services",
  });
  if (adj.maxIntensity !== undefined) out.push({
    key: "intensity", weight: 6, test: (m) => m.intensity <= adj.maxIntensity!,
    miss: () => "it's about as intense as the last pick",
  });
  return out;
}

// Favorites and highly rated imports count as "liked" taste signals.
function likedMovies(taste: Taste): { movie: Movie; why: string }[] {
  const fav = taste.favorites.map((id) => ({ movie: MOVIES.find((m) => m.id === id)!, why: "one of your favorites" }));
  const rated = Object.entries(taste.ratings)
    .filter(([id, stars]) => stars >= 4 && !taste.favorites.includes(id))
    .map(([id, stars]) => ({ movie: MOVIES.find((m) => m.id === id)!, why: `you rated it ${stars} stars on Letterboxd` }));
  return [...fav, ...rated].filter((x) => x.movie);
}

function tasteSignal(m: Movie, taste: Taste): { bonus: number; note?: string } {
  if (taste.watchlist.includes(m.id)) return { bonus: 3, note: "It's been waiting on your Letterboxd watchlist." };
  for (const liked of likedMovies(taste)) {
    const shared = m.genres.find((g) => liked.movie.genres.includes(g));
    if (shared && liked.movie.id !== m.id)
      return { bonus: 1.5, note: `It shares the ${lower(shared)} streak of ${liked.movie.title} (${liked.why}).` };
  }
  return { bonus: 0 };
}

function occasionBonus(m: Movie, occasion?: string): number {
  if (occasion === "date") return (m.genres.some((g) => g === "Romance" || g === "Comedy") ? 1 : 0) - (m.genres.includes("Horror") ? 1 : 0);
  if (occasion === "background") return m.attention === "background" ? 2 : m.attention === "easy" ? 1 : -1;
  if (occasion === "movienight") return m.genres.some((g) => g === "Adventure" || g === "Action" || g === "Comedy") ? 1 : 0;
  if (occasion === "solo") return m.intensity < 3 ? 0.5 : 0;
  return 0;
}

export type RecommendInput = {
  answers: Answers;
  asked: QuestionKey[];
  must: Must;
  taste: Taste;
  services: ServiceId[]; // tonight's session services
  includeRewatches: boolean;
  exclude: string[]; // shown or rejected in this flow
  adjustments: Adjustments;
};

export type Result =
  | { kind: "pick"; movie: Movie; rationale: string }
  | { kind: "nearmiss"; movie: Movie; misses: string[]; missedKeys: MustKey[] }
  | { kind: "empty" };

export function recommend(input: RecommendInput): Result {
  const { answers, asked, must, taste, services, includeRewatches, exclude, adjustments } = input;
  const all = criteria(answers, asked, services, adjustments);
  const hard = all.filter((c) => c.key !== "intensity" && must[c.key as MustKey]);
  const flex = all.filter((c) => !hard.includes(c));
  const occasion = answers.occasion?.[0];

  const pool = MOVIES.filter((m) => !exclude.includes(m.id) && (includeRewatches || !taste.watched.includes(m.id)));
  if (!pool.length) return { kind: "empty" };

  const rank = (m: Movie) =>
    all.reduce((s, c) => s + (c.test(m) ? (flex.includes(c) ? c.weight : 0) + (c.bonus?.(m) ?? 0) : 0), 0) +
    tasteSignal(m, taste).bonus +
    occasionBonus(m, occasion) -
    4 * m.genres.filter((g) => adjustments.avoidGenres.includes(g)).length -
    3 * m.moods.filter((x) => adjustments.avoidMoods.includes(x)).length +
    m.score * 0.3;

  const eligible = pool.filter((m) => hard.every((c) => c.test(m))).sort((a, b) => rank(b) - rank(a));
  if (eligible.length) {
    // "Surprise me" picks among the top few so the same answers don't always land on one title.
    const movie = occasion === "surprise" ? eligible[Math.floor(Math.random() * Math.min(3, eligible.length))] : eligible[0];
    return { kind: "pick", movie, rationale: rationale(movie, answers, asked, taste, services, flex) };
  }

  // Nothing meets every Must have: find the closest candidate and explain what it would miss.
  const misses = (m: Movie) => hard.filter((c) => !c.test(m));
  const closest = [...pool].sort((a, b) => misses(a).length - misses(b).length || rank(b) - rank(a))[0];
  const missed = misses(closest);
  return { kind: "nearmiss", movie: closest, misses: missed.map((c) => c.miss(closest)), missedKeys: missed.map((c) => c.key as MustKey) };
}

const ATTENTION_ADJ = { background: "A low-effort", easy: "An easygoing", absorbing: "A fully absorbing" } as const;
const OCCASION_PHRASE: Record<string, string> = {
  solo: " for a solo unwind",
  date: " for date night",
  background: " that's happy to play in the background",
  movienight: " for movie night",
};

export function rationale(m: Movie, answers: Answers, asked: QuestionKey[], taste: Taste, services: ServiceId[], flex: Criterion[] = []): string {
  const wanted = isOpen(answers.genres) ? [] : answers.genres!;
  const matched = m.genres.filter((g) => wanted.includes(g));
  const genrePhrase = (matched.length ? matched : m.genres.slice(0, 2)).map(lower).join("-");
  const time = answers.time?.[0];
  const timePhrase = time && time !== "any" && m.runtime < Number(time)
    ? ` ${lower(optionLabel("time", time)).replace("2 hours", "two hours")}`
    : ` at ${fmtRuntime(m.runtime)}`;
  const parts = [`${ATTENTION_ADJ[m.attention]} ${genrePhrase}${timePhrase}${OCCASION_PHRASE[answers.occasion?.[0] ?? ""] ?? ""}.`];

  const mood = asked.includes("mood") ? answers.mood?.[0] : undefined;
  if (mood && m.moods.includes(mood as Movie["moods"][number])) parts.push(`It hits the ${lower(mood)} note you asked for.`);

  const note = tasteSignal(m, taste).note;
  if (note) parts.push(note);

  const missed = flex.filter((c) => c.key !== "services" && !c.test(m));
  if (missed.length) parts.push(`Heads-up: ${missed.map((c) => c.miss(m)).join("; ")}. Everything else lined up best.`);
  if (services.length && !onServices(m, services)) parts.push("It isn't on your services, so here are other ways to watch.");
  return parts.join(" ");
}

// ---------- Random pick ----------

export function randomPick(taste: Taste, includeRewatches: boolean, exclude: string[]): { movie: Movie; personal: boolean } | null {
  const pool = MOVIES.filter((m) => !exclude.includes(m.id) && (includeRewatches || !taste.watched.includes(m.id)));
  if (!pool.length) return null;
  const personal = taste.services.length > 0 || hasTaste(taste);
  if (!personal) return { movie: pool[Math.floor(Math.random() * pool.length)], personal };
  const score = (m: Movie) => (taste.services.length && onServices(m, taste.services) ? 4 : 0) + tasteSignal(m, taste).bonus + m.score * 0.3;
  const top = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 6);
  return { movie: top[Math.floor(Math.random() * top.length)], personal };
}
