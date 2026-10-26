// Curated sample catalog for the CineMatch demo. Titles are fictional; availability,
// audience scores, trending, and the Letterboxd import are illustrative US sample data.

export type ServiceId = "netflix" | "prime" | "paramount" | "disney" | "hulu" | "apple" | "hbo" | "tubi";

export type Service = { id: ServiceId; name: string; url: string; free: boolean };

// Links go to each service's home page only, never to a specific movie.
export const SERVICES: Service[] = [
  { id: "netflix", name: "Netflix", url: "https://www.netflix.com", free: false },
  { id: "prime", name: "Amazon Prime Video", url: "https://www.primevideo.com", free: false },
  { id: "paramount", name: "Paramount+", url: "https://www.paramountplus.com", free: false },
  { id: "disney", name: "Disney+", url: "https://www.disneyplus.com", free: false },
  { id: "hulu", name: "Hulu", url: "https://www.hulu.com", free: false },
  { id: "apple", name: "Apple TV", url: "https://tv.apple.com", free: false },
  { id: "hbo", name: "HBO Max", url: "https://www.hbomax.com", free: false },
  { id: "tubi", name: "Tubi", url: "https://tubitv.com", free: true },
];

export const serviceById = (id: ServiceId) => SERVICES.find((s) => s.id === id)!;

export const GENRES = [
  "Comedy", "Drama", "Action", "Adventure", "Thriller", "Mystery",
  "Horror", "Romance", "Sci-fi", "Fantasy", "Animation", "Documentary",
] as const;
export type Genre = (typeof GENRES)[number];

export const MOODS = ["Light and funny", "Comforting", "Emotional", "Suspenseful", "Serious and thought-provoking"] as const;
export type Mood = (typeof MOODS)[number];

export type Attention = "background" | "easy" | "absorbing";
export const RATINGS = ["G", "PG", "PG-13", "R"] as const;
export type Rating = (typeof RATINGS)[number];

export type AvailabilityType = "subscription" | "free" | "rent";
export type Availability = { service: ServiceId; type: AvailabilityType };

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: number; // minutes
  rating: Rating;
  score: number; // sample audience score out of 5
  genres: Genre[];
  moods: Mood[];
  attention: Attention;
  intensity: 1 | 2 | 3;
  synopsis: string;
  availability: Availability[];
  poster: number; // index into the poster palette
};

const sub = (service: ServiceId): Availability => ({ service, type: "subscription" });
const rent = (service: ServiceId): Availability => ({ service, type: "rent" });
const tubi: Availability = { service: "tubi", type: "free" };

export const MOVIES: Movie[] = [
  { id: "lighthouse-bakery", title: "The Lighthouse Bakery", year: 2021, runtime: 98, rating: "PG", score: 3.9,
    genres: ["Comedy", "Romance"], moods: ["Light and funny", "Comforting"], attention: "easy", intensity: 1,
    synopsis: "A burned-out chef inherits a seaside bakery and a town that refuses to let it close.",
    availability: [sub("netflix"), tubi], poster: 0 },
  { id: "signal-lost", title: "Signal Lost", year: 2019, runtime: 112, rating: "PG-13", score: 3.7,
    genres: ["Thriller", "Mystery"], moods: ["Suspenseful"], attention: "absorbing", intensity: 3,
    synopsis: "A radio operator on a remote station picks up a distress call from a ship that sank 40 years ago.",
    availability: [sub("hulu"), rent("prime")], poster: 1 },
  { id: "paper-planets", title: "Paper Planets", year: 2022, runtime: 124, rating: "PG", score: 4.2,
    genres: ["Drama"], moods: ["Emotional", "Serious and thought-provoking"], attention: "absorbing", intensity: 1,
    synopsis: "Two estranged siblings rebuild their late father's backyard observatory over one summer.",
    availability: [sub("apple")], poster: 2 },
  { id: "hollow-pines", title: "Night Shift at Hollow Pines", year: 2020, runtime: 89, rating: "R", score: 3.4,
    genres: ["Horror"], moods: ["Suspenseful"], attention: "easy", intensity: 3,
    synopsis: "A new night nurse discovers the patients in Ward C haven't aged in decades.",
    availability: [sub("paramount"), tubi], poster: 3 },
  { id: "office-olympics", title: "Office Olympics", year: 2018, runtime: 94, rating: "PG-13", score: 3.5,
    genres: ["Comedy"], moods: ["Light and funny"], attention: "background", intensity: 1,
    synopsis: "Rival departments compete in an increasingly unhinged corporate team-building tournament.",
    availability: [sub("netflix"), sub("prime")], poster: 4 },
  { id: "midnight-express-lane", title: "Midnight Express Lane", year: 2023, runtime: 131, rating: "R", score: 3.8,
    genres: ["Action", "Thriller"], moods: ["Suspenseful"], attention: "easy", intensity: 3,
    synopsis: "A getaway driver has one night to deliver a package across a city that wants it back.",
    availability: [sub("hbo"), rent("apple")], poster: 1 },
  { id: "sunday-gardens", title: "Sunday Gardens", year: 2017, runtime: 102, rating: "PG", score: 3.6,
    genres: ["Romance", "Comedy"], moods: ["Comforting", "Light and funny"], attention: "background", intensity: 1,
    synopsis: "Neighbors feuding over a community garden slowly realize they're on the same side.",
    availability: [sub("hulu"), tubi], poster: 0 },
  { id: "quiet-archive", title: "The Quiet Archive", year: 2021, runtime: 118, rating: "PG-13", score: 4.1,
    genres: ["Mystery", "Drama"], moods: ["Suspenseful", "Serious and thought-provoking"], attention: "absorbing", intensity: 2,
    synopsis: "A librarian finds coded notes in returned books that point to an unsolved disappearance.",
    availability: [sub("hbo")], poster: 2 },
  { id: "whiskers-in-space", title: "Whiskers in Space", year: 2022, runtime: 86, rating: "G", score: 4.0,
    genres: ["Animation", "Sci-fi", "Comedy"], moods: ["Light and funny", "Comforting"], attention: "easy", intensity: 1,
    synopsis: "A ship's cat accidentally takes command of an interstellar cargo freighter.",
    availability: [sub("disney")], poster: 4 },
  { id: "basement-tapes", title: "Basement Tapes", year: 2019, runtime: 95, rating: "R", score: 3.3,
    genres: ["Horror"], moods: ["Suspenseful"], attention: "absorbing", intensity: 3,
    synopsis: "Old VHS tapes found in a new house start showing footage of tomorrow.",
    availability: [tubi, rent("prime")], poster: 3 },
  { id: "long-road-north", title: "Long Road North", year: 2016, runtime: 141, rating: "PG-13", score: 4.4,
    genres: ["Drama", "Adventure"], moods: ["Emotional"], attention: "absorbing", intensity: 2,
    synopsis: "A retired trucker drives his granddaughter across the country to scatter her mother's ashes.",
    availability: [sub("netflix")], poster: 2 },
  { id: "wedding-crashers-anon", title: "Wedding Crashers Anonymous", year: 2024, runtime: 104, rating: "R", score: 3.2,
    genres: ["Comedy"], moods: ["Light and funny"], attention: "background", intensity: 1,
    synopsis: "A support group for reformed wedding crashers relapses spectacularly at one last ceremony.",
    availability: [sub("prime")], poster: 0 },
  { id: "tin-coast", title: "Treasure of the Tin Coast", year: 1986, runtime: 108, rating: "PG", score: 4.3,
    genres: ["Adventure", "Comedy"], moods: ["Light and funny", "Comforting"], attention: "easy", intensity: 2,
    synopsis: "Three paperboys follow a pirate map from a thrift-store jacket to a very real shipwreck.",
    availability: [sub("hbo"), rent("prime")], poster: 4 },
  { id: "gridlock-gang", title: "Gridlock Gang", year: 2025, runtime: 101, rating: "PG-13", score: 3.8,
    genres: ["Comedy", "Adventure", "Action"], moods: ["Light and funny"], attention: "easy", intensity: 2,
    synopsis: "Four strangers stuck in a citywide traffic jam team up to return a lost wedding ring before sunset.",
    availability: [sub("netflix")], poster: 1 },
  { id: "starfall-academy", title: "Starfall Academy", year: 2024, runtime: 128, rating: "PG", score: 4.0,
    genres: ["Fantasy", "Adventure"], moods: ["Comforting", "Emotional"], attention: "easy", intensity: 2,
    synopsis: "A scholarship student at a school for weather-witches has to stop a storm she started.",
    availability: [sub("disney"), rent("apple")], poster: 3 },
  { id: "orbit-of-two", title: "Orbit of Two", year: 2026, runtime: 117, rating: "PG-13", score: 4.1,
    genres: ["Sci-fi", "Romance"], moods: ["Emotional"], attention: "absorbing", intensity: 1,
    synopsis: "Two astronauts on opposite ends of a relay station fall for each other one radio delay at a time.",
    availability: [sub("apple")], poster: 2 },
  { id: "last-projectionist", title: "The Last Projectionist", year: 2015, runtime: 96, rating: "PG", score: 4.5,
    genres: ["Documentary"], moods: ["Emotional", "Comforting"], attention: "easy", intensity: 1,
    synopsis: "A small-town theater's final 35mm projectionist prepares for the last reel of his career.",
    availability: [sub("paramount"), tubi], poster: 0 },
  { id: "deep-current", title: "Deep Current", year: 2023, runtime: 133, rating: "PG-13", score: 4.2,
    genres: ["Sci-fi", "Thriller"], moods: ["Suspenseful", "Serious and thought-provoking"], attention: "absorbing", intensity: 3,
    synopsis: "A research submarine crew realizes the ocean trench they're mapping is mapping them back.",
    availability: [sub("netflix")], poster: 1 },
  { id: "maple-street-ghosts", title: "Maple Street Ghosts", year: 1989, runtime: 92, rating: "PG", score: 3.7,
    genres: ["Horror", "Comedy"], moods: ["Light and funny", "Suspenseful"], attention: "easy", intensity: 2,
    synopsis: "A family discovers their new house's ghosts are mostly just upset about the wallpaper.",
    availability: [tubi, rent("prime")], poster: 3 },
  { id: "second-serve", title: "Second Serve", year: 2020, runtime: 107, rating: "PG-13", score: 3.9,
    genres: ["Drama", "Comedy"], moods: ["Comforting", "Emotional"], attention: "easy", intensity: 1,
    synopsis: "A washed-up tennis pro coaches a retirement home's doubles team to the state finals.",
    availability: [sub("hulu")], poster: 4 },
  { id: "ironwood", title: "Ironwood", year: 2025, runtime: 146, rating: "R", score: 4.0,
    genres: ["Action", "Adventure"], moods: ["Suspenseful"], attention: "absorbing", intensity: 3,
    synopsis: "A park ranger and a fugitive have to cross a burning forest together before dawn.",
    availability: [sub("hbo"), rent("prime")], poster: 1 },
  { id: "map-room", title: "The Map Room", year: 2018, runtime: 112, rating: "PG-13", score: 3.8,
    genres: ["Mystery", "Adventure"], moods: ["Suspenseful"], attention: "easy", intensity: 2,
    synopsis: "A cartographer's apprentice notices a street on an old city map that doesn't exist. Yet.",
    availability: [sub("prime")], poster: 2 },
  { id: "cosmic-diner", title: "Cosmic Diner", year: 1985, runtime: 99, rating: "PG", score: 4.1,
    genres: ["Sci-fi", "Comedy"], moods: ["Light and funny"], attention: "easy", intensity: 1,
    synopsis: "A roadside diner becomes the only rest stop on an intergalactic highway.",
    availability: [sub("paramount"), rent("apple")], poster: 4 },
  { id: "kingdom-of-kites", title: "Kingdom of Kites", year: 2024, runtime: 94, rating: "G", score: 4.3,
    genres: ["Animation", "Fantasy", "Adventure"], moods: ["Comforting", "Light and funny"], attention: "easy", intensity: 1,
    synopsis: "A girl who builds kites from old maps is carried to a kingdom that lives entirely in the sky.",
    availability: [sub("disney")], poster: 0 },
  { id: "hollow-tide", title: "Hollow Tide", year: 2026, runtime: 109, rating: "R", score: 3.6,
    genres: ["Thriller", "Horror"], moods: ["Suspenseful"], attention: "absorbing", intensity: 3,
    synopsis: "When the tide goes out and doesn't come back, a fishing village finds what it was hiding.",
    availability: [sub("paramount")], poster: 3 },
  { id: "saturday-matinee", title: "Saturday Matinee", year: 1987, runtime: 88, rating: "PG", score: 3.6,
    genres: ["Comedy", "Adventure"], moods: ["Light and funny"], attention: "background", intensity: 1,
    synopsis: "Two kids sneak into every movie at the mall cinema on its last day before demolition.",
    availability: [tubi, sub("prime")], poster: 4 },
  { id: "quiet-hours", title: "Quiet Hours", year: 2019, runtime: 121, rating: "R", score: 4.0,
    genres: ["Drama", "Romance"], moods: ["Emotional", "Serious and thought-provoking"], attention: "absorbing", intensity: 1,
    synopsis: "Two night-shift workers keep meeting at the same laundromat at 3 a.m.",
    availability: [sub("hbo")], poster: 2 },
  { id: "kestrel-bay", title: "Wild Ones of Kestrel Bay", year: 2017, runtime: 89, rating: "G", score: 4.2,
    genres: ["Documentary"], moods: ["Comforting"], attention: "background", intensity: 1,
    synopsis: "A year in the life of a tidal island's seals, puffins, and one very determined otter.",
    availability: [sub("netflix")], poster: 0 },
  { id: "two-tickets-lisbon", title: "Two Tickets to Lisbon", year: 2023, runtime: 103, rating: "PG-13", score: 3.7,
    genres: ["Romance", "Comedy"], moods: ["Light and funny", "Comforting"], attention: "easy", intensity: 1,
    synopsis: "Two travelers double-booked into the same tiny apartment agree to split everything but the bed.",
    availability: [sub("netflix"), rent("prime")], poster: 3 },
  { id: "undertow-files", title: "The Undertow Files", year: 2014, runtime: 138, rating: "R", score: 4.4,
    genres: ["Mystery", "Thriller"], moods: ["Serious and thought-provoking", "Suspenseful"], attention: "absorbing", intensity: 3,
    synopsis: "A coastal-town reporter reopens a drowning case that the whole town agreed to forget.",
    availability: [sub("hulu"), rent("apple")], poster: 1 },
  { id: "pocket-dragon", title: "Pocket Dragon", year: 2021, runtime: 82, rating: "PG", score: 3.5,
    genres: ["Animation", "Fantasy", "Comedy"], moods: ["Light and funny"], attention: "background", intensity: 1,
    synopsis: "A dragon the size of a hamster insists on guarding a fourth grader's lunch money.",
    availability: [sub("netflix"), tubi], poster: 4 },
  { id: "summit", title: "Summit", year: 2016, runtime: 115, rating: "PG-13", score: 3.9,
    genres: ["Adventure", "Drama"], moods: ["Emotional", "Suspenseful"], attention: "absorbing", intensity: 2,
    synopsis: "Three sisters attempt their late mother's unfinished climb, and their first real conversation in years.",
    availability: [sub("prime")], poster: 2 },
];

export const movieById = (id: string) => MOVIES.find((m) => m.id === id)!;

// Sample trending list: fixed, across services, not personalized or live.
export const TRENDING_IDS = ["orbit-of-two", "deep-current", "ironwood", "kingdom-of-kites", "hollow-tide"];

// Sample Letterboxd import. The same illustrative profile is returned for any username.
export const SAMPLE_IMPORT = {
  ratings: { "long-road-north": 5, "quiet-archive": 4, "office-olympics": 3, "signal-lost": 4, "cosmic-diner": 4.5 } as Record<string, number>,
  watched: ["long-road-north", "quiet-archive", "office-olympics", "signal-lost", "cosmic-diner"],
  watchlist: ["tin-coast", "deep-current", "starfall-academy"],
};

// Sample alert shown in the "Available" example state.
export const AVAILABLE_EXAMPLE = { movieId: "paper-planets", service: "apple" as ServiceId };
