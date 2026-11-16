// CM-14: the similarity model.
// Builds a "fingerprint" for every movie from its genres, keywords, synopsis,
// moods, era, runtime and attention level, then finds each movie's 10 nearest
// movies and groups the catalog into clusters with plain-language labels.
//
// Run from web/:  node --env-file=.env.local scripts/similarity.mts [options]
//   --report-only   write data/similarity-report.txt for review, save nothing to the database
//   --clusters N    number of clusters (default 60)
//
// Uses the catalog already in Supabase, so it needs no TMDB calls. Deterministic:
// the same catalog and options always give the same clusters.
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const reportOnly = args.includes("--report-only");
const K = args.includes("--clusters") ? Number(args[args.indexOf("--clusters") + 1]) : 60;
const NEIGHBORS = 10;

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

type Movie = {
  id: string; title: string; year: number; runtime: number; tmdb_genres: string[]; genres: string[];
  moods: string[]; attention: string; keywords: string[]; synopsis: string; popularity: number | null;
};

// Load the catalog ---------------------------------------------------------------

const movies: Movie[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("movies")
    .select("id, title, year, runtime, tmdb_genres, genres, moods, attention, keywords, synopsis, popularity")
    .eq("is_sample", false).order("id").range(from, from + 999);
  if (error) throw new Error(`Reading movies: ${error.message}`);
  movies.push(...(data as Movie[]));
  if (data.length < 1000) break;
}
const N = movies.length;
console.log(`Building fingerprints for ${N} movies.`);

// Fingerprints ---------------------------------------------------------------------
// Each block of features is weighted by how rare each feature is (IDF), scaled to
// unit length, then multiplied by the block's weight, so no single block can
// swamp the others. Two movies' similarity is the weighted sum of how well each
// block matches, from 0 to 1.

const BLOCK_WEIGHTS = { genre: 1.0, keyword: 1.2, words: 0.6, mood: 0.5, era: 0.35, runtime: 0.25, attention: 0.2 };
type Block = keyof typeof BLOCK_WEIGHTS;
// Two movies that match on every block score 1.
const MAX_NORM = Math.hypot(...Object.values(BLOCK_WEIGHTS));

// Keywords that describe the production rather than the movie.
const META_KEYWORDS = new Set([
  "duringcreditsstinger", "aftercreditsstinger", "woman director", "3d", "imax", "remake", "sequel", "prequel",
  "based on novel or book", "based on comic", "based on true story", "based on play or musical", "live action remake",
  "anime", "short film", "black and white", "silent film", "independent film", "lgbt director",
]);
const STOPWORDS = new Set(("the a an and or but of to in on at for with from by as is are was were be been being his her their its "
  + "he she they them him it this that these those who whom which what when where while after before into about over "
  + "than then there here have has had not no nor so too very can will just one two three new also out up down off "
  + "all any some more most other such only own same few each both through during until against between under again "
  + "further once our your you we my me i us film movie story life world find finds must when young man woman year years "
  + "get gets take takes make makes way back lives live help helps begin begins becomes become day time").split(" "));

const eraOf = (y: number) => (y < 1970 ? "pre-1970" : y < 1990 ? "1970s-80s" : y < 2000 ? "1990s" : y < 2010 ? "2000s" : y < 2018 ? "2010s" : "2018+");
const runtimeOf = (r: number) => (r < 95 ? "short" : r < 125 ? "medium" : "long");
const words = (s: string) => s.toLowerCase().match(/[a-z][a-z'-]{2,}/g)?.map((w) => w.replace(/'s$/, "")).filter((w) => !STOPWORDS.has(w)) ?? [];

function rawFeatures(m: Movie): Record<Block, Map<string, number>> {
  const set = (xs: string[]) => new Map(xs.map((x) => [x, 1] as [string, number]));
  const wordCounts = new Map<string, number>();
  for (const w of words(`${m.title} ${m.synopsis}`)) wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  return {
    genre: set(m.tmdb_genres.length ? m.tmdb_genres : m.genres),
    keyword: set(m.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k && !META_KEYWORDS.has(k))),
    words: wordCounts,
    mood: set(m.moods),
    era: set([eraOf(m.year)]),
    runtime: set([runtimeOf(m.runtime)]),
    attention: set([m.attention]),
  };
}

const raw = movies.map(rawFeatures);
const blocks = Object.keys(BLOCK_WEIGHTS) as Block[];

// How many movies have each feature, to weight rare features more.
const df = new Map<string, number>();
for (const r of raw) for (const b of blocks) for (const f of r[b].keys()) df.set(`${b}:${f}`, (df.get(`${b}:${f}`) ?? 0) + 1);

// A feature only one movie has can't make two movies similar; very common synopsis
// words say little. Both are dropped.
const keep = (b: Block, key: string) => {
  const n = df.get(key)!;
  if (b === "keyword") return n >= 2;
  if (b === "words") return n >= 3 && n <= N * 0.08;
  return true;
};

const featureIndex = new Map<string, number>();
const featureNames: string[] = [];
type Vec = { idx: Int32Array; val: Float64Array };

function fingerprint(r: Record<Block, Map<string, number>>): Vec {
  const out = new Map<number, number>();
  for (const b of blocks) {
    const entries: [number, number][] = [];
    for (const [f, tf] of r[b]) {
      const key = `${b}:${f}`;
      if (!keep(b, key)) continue;
      const idf = Math.log(N / df.get(key)!) + 1;
      const weight = (b === "words" ? 1 + Math.log(tf) : 1) * idf;
      if (!featureIndex.has(key)) { featureIndex.set(key, featureNames.length); featureNames.push(key); }
      entries.push([featureIndex.get(key)!, weight]);
    }
    const norm = Math.hypot(...entries.map(([, v]) => v)) || 1;
    for (const [i, v] of entries) out.set(i, (v / norm) * BLOCK_WEIGHTS[b]);
  }
  // Not rescaled as a whole: a movie with no keywords simply has no keyword part,
  // so it can't look like a close match on broad traits alone.
  const sorted = [...out].sort((a, b) => a[0] - b[0]);
  return { idx: Int32Array.from(sorted.map(([i]) => i)), val: Float64Array.from(sorted.map(([, v]) => v / MAX_NORM)) };
}

const vecs = raw.map(fingerprint);
const F = featureNames.length;
console.log(`${F} features in use.`);

// Nearest movies --------------------------------------------------------------------
// Exact cosine similarity against every other movie, using an index from each
// feature to the movies that have it.

const postings: { movie: number; val: number }[][] = Array.from({ length: F }, () => []);
vecs.forEach((v, m) => v.idx.forEach((f, k) => postings[f].push({ movie: m, val: v.val[k] })));

const neighbors: { movie: number; score: number }[][] = [];
const scores = new Float64Array(N);
const touched: number[] = [];
for (let m = 0; m < N; m++) {
  const v = vecs[m];
  for (let k = 0; k < v.idx.length; k++) {
    const q = v.val[k];
    for (const p of postings[v.idx[k]]) {
      if (scores[p.movie] === 0) touched.push(p.movie);
      scores[p.movie] += q * p.val;
    }
  }
  const top: { movie: number; score: number }[] = [];
  for (const o of touched) {
    if (o !== m) {
      const s = scores[o];
      if (top.length < NEIGHBORS || s > top[top.length - 1].score) {
        top.push({ movie: o, score: s });
        top.sort((a, b) => b.score - a.score);
        if (top.length > NEIGHBORS) top.pop();
      }
    }
    scores[o] = 0;
  }
  touched.length = 0;
  neighbors.push(top);
  if ((m + 1) % 1000 === 0) process.stdout.write(`\rNearest movies: ${m + 1}/${N}`);
}
console.log();

// Clusters ----------------------------------------------------------------------------
// Spherical k-means: each movie joins the cluster whose average fingerprint it's
// most similar to. Seeded, so reruns give the same clusters.

let seed = 14;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const dot = (v: Vec, c: Float64Array) => { let s = 0; for (let k = 0; k < v.idx.length; k++) s += v.val[k] * c[v.idx[k]]; return s; };

// k-means++ start: spread the first centers out.
const centers: Float64Array[] = [];
const toDense = (v: Vec) => { const c = new Float64Array(F); v.idx.forEach((f, k) => (c[f] = v.val[k])); return c; };
centers.push(toDense(vecs[Math.floor(rand() * N)]));
const best = new Float64Array(N).fill(-Infinity);
while (centers.length < K) {
  const c = centers[centers.length - 1];
  let total = 0;
  const dist = new Float64Array(N);
  for (let m = 0; m < N; m++) { best[m] = Math.max(best[m], dot(vecs[m], c)); dist[m] = Math.max(0, 1 - best[m]) ** 2; total += dist[m]; }
  let r = rand() * total, pick = 0;
  while (r > dist[pick] && pick < N - 1) r -= dist[pick++];
  centers.push(toDense(vecs[pick]));
}

const cluster = new Int32Array(N).fill(-1);
for (let iter = 0; iter < 30; iter++) {
  let moved = 0;
  for (let m = 0; m < N; m++) {
    let bestC = 0, bestS = -Infinity;
    for (let c = 0; c < K; c++) { const s = dot(vecs[m], centers[c]); if (s > bestS) { bestS = s; bestC = c; } }
    if (cluster[m] !== bestC) { cluster[m] = bestC; moved++; }
  }
  for (let c = 0; c < K; c++) centers[c].fill(0);
  vecs.forEach((v, m) => v.idx.forEach((f, k) => (centers[cluster[m]][f] += v.val[k])));
  for (const c of centers) { let n = 0; for (const x of c) n += x * x; n = Math.sqrt(n) || 1; for (let i = 0; i < F; i++) c[i] /= n; }
  process.stdout.write(`\rClustering: pass ${iter + 1}, ${moved} movies moved`);
  if (moved < N * 0.002) break;
}
console.log();

// Plain-language labels ------------------------------------------------------------------
// The cluster's most typical mood and genres, plus the two keywords most
// over-represented in it compared with the whole catalog.

const share = (members: number[], pick: (m: Movie) => string[]) => {
  const counts = new Map<string, number>();
  for (const i of members) for (const x of new Set(pick(movies[i]))) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].map(([x, n]) => ({ x, share: n / members.length, n })).sort((a, b) => b.share - a.share);
};

const clusters = Array.from({ length: K }, (_, c) => {
  const members = [...cluster.keys()].filter((m) => cluster[m] === c);
  const genres = share(members, (m) => m.tmdb_genres.map((g) => (g === "TV Movie" ? "TV" : g))).filter((g) => g.share >= 0.4).slice(0, 2).map((g) => g.x.toLowerCase());
  const mood = share(members, (m) => m.moods)[0];
  const keywords = share(members, (m) => rawFeatures(m).keyword.size ? [...rawFeatures(m).keyword.keys()] : [])
    .filter((k) => k.n >= Math.max(3, members.length * 0.1))
    .map((k) => ({ ...k, score: k.share * Math.log(k.share / (df.get(`keyword:${k.x}`)! / N)) }))
    .sort((a, b) => b.score - a.score).slice(0, 2).map((k) => k.x);
  const head = [mood && mood.share >= 0.4 ? mood.x : "", genres.length ? genres.reverse().join(" ") : "mixed-genre", "movies"].filter(Boolean).join(" ");
  const label = (keywords.length ? `${head}: ${keywords.join(", ")}` : head).replace(/^./, (s) => s.toUpperCase());
  const examples = [...members].sort((a, b) => (movies[b].popularity ?? 0) - (movies[a].popularity ?? 0)).slice(0, 5).map((i) => movies[i].title);
  return { id: c + 1, label, size: members.length, examples };
});

// Report for review (scenario 2) ---------------------------------------------------------

const WELL_KNOWN = ["The Matrix", "Toy Story", "The Godfather", "Titanic", "Get Out", "Mean Girls", "Jurassic Park", "The Notebook", "Spirited Away", "Mad Max: Fury Road"];
const lines: string[] = [`CM-14 similarity report: ${N} movies, ${F} features, ${K} clusters.`, ""];
lines.push("Scenario 2: the five nearest movies for 10 well-known films. Mark each set similar or not.", "");
for (const title of WELL_KNOWN) {
  const m = movies.findIndex((x) => x.title === title);
  if (m < 0) { lines.push(`${title}: not in the catalog`, ""); continue; }
  lines.push(`${movies[m].title} (${movies[m].year}), cluster ${cluster[m] + 1}: ${clusters[cluster[m]].label}`);
  for (const n of neighbors[m].slice(0, 5)) lines.push(`   ${n.score.toFixed(2)}  ${movies[n.movie].title} (${movies[n.movie].year})`);
  lines.push("");
}
lines.push("Clusters (largest first), with their five most popular movies:", "");
for (const c of [...clusters].sort((a, b) => b.size - a.size)) lines.push(`${String(c.id).padStart(2)}. ${c.label}  [${c.size} movies]`, `    ${c.examples.join(" · ")}`);
const noKeywords = movies.filter((m) => !rawFeatures(m).keyword.size).length;
lines.push("", `Scenario 3: ${noKeywords} movies have no usable keywords; all ${N} still got a fingerprint, neighbors, and a cluster.`);

mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
const reportFile = new URL("../data/similarity-report.txt", import.meta.url);
writeFileSync(reportFile, lines.join("\n"));
console.log(`Report written to web/data/similarity-report.txt`);

if (reportOnly) process.exit(0);
console.error("Saving to the database isn't built yet. Run with --report-only.");
process.exit(1);
