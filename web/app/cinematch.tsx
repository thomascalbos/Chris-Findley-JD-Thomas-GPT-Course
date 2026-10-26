'use client'

import { useMemo, useState } from "react";
import {
  CORE, NO_ADJUSTMENTS, QUESTIONS, canNotify, followUps, isOpen, paidServices, randomPick, recommend, rationale,
  type Adjustments, type Answers, type Must, type QuestionKey, type Result, type Taste,
} from "./engine";
import { MOVIES, SAMPLE_IMPORT, SERVICES, TRENDING_IDS, movieById, serviceById, type Movie, type ServiceId } from "./movies";
import {
  Chip, Heading, Icon, MovieCard, Panel, Poster, PrimaryButton, SampleTag, SecondaryButton, Stars, TextButton, Toggle,
  WatchLink, inputClass,
} from "./ui";

type View = "home" | "onboarding" | "account" | "questions" | "nearmiss" | "pick" | "reject" | "empty" | "random" | "trending" | "alerts" | "history";
type OnboardStep = "account" | "services" | "letterboxd" | "favorites" | "finish";
type Pending = { kind: "alert"; movieId: string } | { kind: "save-pick" };
type Delivery = "email" | "inapp" | "both";
type Alert = { id: number; movieId: string; delivery: Delivery; services: ServiceId[] };
type Import = { username: string; ratings: Record<string, number>; watched: string[]; watchlist: string[] };
type LogEntry = { id: number; movieId: string; event: string; at: string };

const DEMO_EMAIL = "viewer@example.com";
const DELIVERY_LABEL: Record<Delivery, string> = { email: "Email", inapp: "In-app", both: "Email and in-app" };
const NAV = [
  { view: "home", label: "Home", icon: "home" },
  { view: "random", label: "Random", icon: "random" },
  { view: "trending", label: "Trending", icon: "trending" },
  { view: "alerts", label: "Alerts", icon: "alerts" },
] as const;
const REJECT_REASONS = [
  { id: "seen", label: "Seen it" },
  { id: "mood", label: "Wrong mood" },
  { id: "genre", label: "Dislike the genre" },
  { id: "intense", label: "Too intense" },
  { id: "other", label: "Something else" },
] as const;

let nextId = 1;
const stamp = () => new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function CineMatch() {
  const [view, setView] = useState<View>("home");
  const [onboardStep, setOnboardStep] = useState<OnboardStep>("account");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  // Account and saved taste (sample, in memory only)
  const [user, setUser] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [services, setServices] = useState<ServiceId[]>([]);
  const [imported, setImported] = useState<Import | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [markedWatched, setMarkedWatched] = useState<string[]>([]);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [log, setLog] = useState<LogEntry[]>([]); // guests' entries are kept for the session and saved on sign-in
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  // Tonight's questionnaire session
  const [answers, setAnswers] = useState<Answers>({});
  const [must, setMust] = useState<Must>({});
  const [step, setStep] = useState(0);
  const [includeRewatches, setIncludeRewatches] = useState(false);
  const [exclude, setExclude] = useState<string[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustments>(NO_ADJUSTMENTS);
  const [result, setResult] = useState<Result | null>(null);
  const [flowStart, setFlowStart] = useState(0);

  // Random page and alert draft
  const [randomId, setRandomId] = useState<string | null>(null);
  const [randomPersonal, setRandomPersonal] = useState(false);
  const [draftAlert, setDraftAlert] = useState<{ movieId: string; delivery: Delivery } | null>(null);

  const taste: Taste = useMemo(
    () => ({
      services,
      favorites,
      ratings: imported?.ratings ?? {},
      watchlist: imported?.watchlist ?? [],
      watched: [...new Set([...(imported?.watched ?? []), ...markedWatched])],
    }),
    [services, favorites, imported, markedWatched],
  );
  const steps = useMemo(() => [...CORE, ...(answers.time ? followUps(answers, taste) : [])], [answers, taste]);
  const pick = result && result.kind !== "empty" ? result.movie : null;

  function go(v: View) {
    setDetailsId(null);
    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  function addLog(movieId: string, event: string) {
    setLog((l) => [{ id: nextId++, movieId, event, at: stamp() }, ...l]);
  }

  // ----- Accounts -----

  function askForAccount(p: Pending) {
    setPending(p);
    go("account");
  }

  function signIn() {
    setUser(DEMO_EMAIL);
    if (view === "account") {
      if (onboarded) resume();
      else {
        setOnboardStep("services");
        go("onboarding");
      }
    }
  }

  function resume() {
    const p = pending;
    setPending(null);
    setOnboarded(true);
    if (p?.kind === "alert") {
      setDraftAlert((d) => (d?.movieId === p.movieId ? d : { movieId: p.movieId, delivery: "both" }));
      go("alerts");
    } else if (p?.kind === "save-pick") go("pick");
    else go("home");
  }

  // ----- Questionnaire -----

  function startFlow() {
    setStep(0);
    setExclude([]);
    setAdjustments(NO_ADJUSTMENTS);
    setResult(null);
    setFlowStart(Date.now());
    go("questions");
  }

  function setAnswer(key: QuestionKey, value: string) {
    const q = QUESTIONS[key];
    const current = answers[key] ?? [];
    let next: string[];
    if (!q.multi) next = [value];
    else if (value === q.exclusive) next = current.includes(value) ? [] : [value];
    else {
      const without = current.filter((v) => v !== q.exclusive);
      next = without.includes(value) ? without.filter((v) => v !== value) : without.length < q.multi ? [...without, value] : without;
    }
    setAnswers({ ...answers, [key]: next });
    if (isOpen(next)) setMust({ ...must, [key]: false });
  }

  function run(nextExclude: string[], nextAdj: Adjustments, nextTaste = taste) {
    const r = recommend({
      answers, asked: steps, must, taste: nextTaste, services, includeRewatches, exclude: nextExclude, adjustments: nextAdj,
    });
    setResult(r);
    if (r.kind === "pick") {
      setExclude([...nextExclude, r.movie.id]);
      addLog(r.movie.id, "Recommended");
      go("pick");
    } else go(r.kind === "nearmiss" ? "nearmiss" : "empty");
  }

  function revealNearMiss() {
    if (result?.kind !== "nearmiss") return;
    const movie = result.movie;
    const why = rationale(movie, answers, steps, taste, services);
    setResult({ kind: "pick", movie, rationale: `${why} It misses your Must have: ${result.misses.join("; ")}.` });
    setExclude([...exclude, movie.id]);
    addLog(movie.id, "Recommended (closest match, with your OK)");
    go("pick");
  }

  function adjustAnswers() {
    // Jump to the question behind the first missed Must have so the viewer can loosen it.
    // A missed service requirement lands on the first question, where the session bar shows it.
    const missed = result?.kind === "nearmiss" ? result.missedKeys : [];
    setStep(Math.max(0, steps.findIndex((k) => missed.includes(k))));
    go("questions");
  }

  function reject(reason: (typeof REJECT_REASONS)[number]["id"]) {
    if (!pick) return;
    const label = REJECT_REASONS.find((r) => r.id === reason)!.label;
    addLog(pick.id, `Not this one: ${label.toLowerCase()}`);
    const adj = { ...adjustments };
    let nextTaste = taste;
    if (reason === "seen") {
      setMarkedWatched((w) => [...w, pick.id]);
      nextTaste = { ...taste, watched: [...taste.watched, pick.id] };
    }
    if (reason === "mood") adj.avoidMoods = [...adj.avoidMoods, ...pick.moods];
    if (reason === "genre") {
      const wanted = answers.genres ?? [];
      const unwanted = pick.genres.filter((g) => !wanted.includes(g));
      adj.avoidGenres = [...adj.avoidGenres, ...(unwanted.length ? unwanted : pick.genres.slice(0, 1))];
    }
    if (reason === "intense") adj.maxIntensity = Math.max(1, pick.intensity - 1);
    setAdjustments(adj);
    run(exclude, adj, nextTaste);
  }

  function watch(movie: Movie, service: ServiceId) {
    const secs = flowStart && pick?.id === movie.id ? ` after ${Math.round((Date.now() - flowStart) / 1000)}s` : "";
    addLog(movie.id, `Watch handoff to ${serviceById(service).name}${secs}`);
  }

  function notify(movieId: string) {
    setDraftAlert({ movieId, delivery: draftAlert?.movieId === movieId ? draftAlert.delivery : "both" });
    go("alerts");
  }

  function openRandom() {
    if (!randomId) rollRandom();
    go("random");
  }

  function rollRandom() {
    const r = randomPick(taste, includeRewatches, randomId ? [randomId] : []);
    setRandomId(r?.movie.id ?? null);
    setRandomPersonal(r?.personal ?? false);
    if (r) addLog(r.movie.id, "Random pick");
  }

  const navActive = (v: View) => view === v || (v === "home" && ["questions", "pick", "reject", "nearmiss", "empty", "history"].includes(view));

  // ----- Screens -----

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-teal/10 bg-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <button type="button" onClick={() => go("home")} className="font-display text-2xl md:text-[28px]">
            Cine<span className="text-brick">Match</span>
          </button>
          <nav aria-label="Primary" className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.view}
                type="button"
                aria-current={navActive(n.view) ? "page" : undefined}
                onClick={() => (n.view === "random" ? openRandom() : go(n.view))}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium ${navActive(n.view) ? "bg-teal text-ivory" : "hover:bg-sand"}`}
              >
                <Icon name={n.icon} /> {n.label}
              </button>
            ))}
          </nav>
          <AccountControl user={user} onSignIn={() => { setPending(null); go("account"); }} onHistory={() => go("history")} onSignOut={() => { setUser(null); go("home"); }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {view === "home" && (
          <div className="space-y-8">
            <section className="rounded-3xl bg-teal p-6 text-ivory md:p-10">
              <p className="text-xs font-medium uppercase tracking-widest text-cream">Tonight at the counter</p>
              <h1 className="mt-2 font-display text-[32px] leading-tight md:text-[40px]">One movie worth watching. No endless scrolling.</h1>
              <p className="mt-3 max-w-xl text-ivory/90">
                Answer three quick questions (maybe a couple more). I&apos;ll hand you one pick and tell you exactly why.
              </p>
              <button
                type="button"
                onClick={startFlow}
                className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-cream px-6 text-base font-medium text-teal hover:bg-ivory"
              >
                Find tonight&apos;s movie
              </button>
            </section>

            {!onboarded && (
              <Panel className="flex flex-col gap-4 border-dashed sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-[22px]">Set up your taste <span className="text-base text-plum">(optional)</span></h2>
                  <p className="text-plum">Services, a Letterboxd sample import, and up to five favorites. Skip it and I&apos;ll still find you something.</p>
                </div>
                <SecondaryButton onClick={() => { setOnboardStep(user ? "services" : "account"); go("onboarding"); }}>Set up</SecondaryButton>
              </Panel>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { v: "random" as const, title: "Random pick", body: "Skip the questions. One movie from your saved taste." },
                { v: "trending" as const, title: "Top 5 trending", body: "Five sample favorites across every service." },
                { v: "alerts" as const, title: "Alerts", body: "Hear when a movie lands on your paid services." },
              ].map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => (t.v === "random" ? openRandom() : go(t.v))}
                  className="rounded-2xl border-2 border-teal/15 bg-white/60 p-4 text-left hover:border-teal"
                >
                  <p className="font-display text-[22px]">{t.title}</p>
                  <p className="text-[15px] text-plum">{t.body}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <TextButton onClick={() => go("history")}>Your history</TextButton>
              <SampleTag>Demo: availability, scores, trends, and imports are sample data</SampleTag>
            </div>
          </div>
        )}

        {view === "onboarding" && (
          <Onboarding
            step={onboardStep}
            setStep={setOnboardStep}
            user={user}
            onSignIn={() => setUser(DEMO_EMAIL)}
            services={services}
            setServices={setServices}
            imported={imported}
            setImported={setImported}
            favorites={favorites}
            setFavorites={setFavorites}
            pending={pending}
            onFinish={resume}
            onFind={() => { setOnboarded(true); setPending(null); startFlow(); }}
            onSkipAll={() => { setOnboarded(true); go("home"); }}
          />
        )}

        {view === "account" && (
          <div className="mx-auto max-w-lg">
            <Heading
              eyebrow="Account"
              title={pending ? "Let's save that for you" : "Sign in"}
              subtitle={
                pending?.kind === "alert"
                  ? `Alerts live on an account. Create one and I'll hang on to ${movieById(pending.movieId).title} for you.`
                  : pending?.kind === "save-pick"
                    ? `History lives on an account. Create one and ${pick?.title ?? "your pick"} stays right where you left it.`
                    : "Save favorites, history, and alerts to an account."
              }
            />
            <Panel className="space-y-3">
              <SampleTag>Sample account: no real sign-in happens</SampleTag>
              <input readOnly aria-label="Email" value={DEMO_EMAIL} className={inputClass} />
              <input readOnly aria-label="Password" type="password" value="password" className={inputClass} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <PrimaryButton onClick={signIn}>Create account</PrimaryButton>
                <SecondaryButton onClick={signIn}>Sign in</SecondaryButton>
                <TextButton onClick={() => { const p = pending; setPending(null); go(p?.kind === "alert" ? "alerts" : p ? "pick" : "home"); }}>
                  Not now
                </TextButton>
              </div>
            </Panel>
          </div>
        )}

        {view === "questions" && (() => {
          const key = steps[step];
          const q = QUESTIONS[key];
          const value = answers[key] ?? [];
          const isCore = step < CORE.length;
          const last = step === steps.length - 1;
          return (
            <div className="mx-auto max-w-2xl">
              <Progress step={step} steps={steps} />
              <Panel className="mt-4">
                <h1 className="text-xl font-medium md:text-[22px]">{q.title}</h1>
                {q.help && <p className="mt-1 text-[15px] text-plum">{q.help}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <Chip key={o.value} selected={value.includes(o.value)} onClick={() => setAnswer(key, o.value)}>{o.label}</Chip>
                  ))}
                </div>
                {q.multi && value.length > 0 && !isOpen(value) && (
                  <p className="mt-2 text-[14px] text-plum" aria-live="polite">{value.length} of {q.multi} selected</p>
                )}
                {key !== "occasion" && (
                  <div className="mt-5 border-t border-teal/10 pt-4">
                    <Toggle
                      label="Must have"
                      checked={!!must[key]}
                      disabled={isOpen(value)}
                      onChange={(v) => setMust({ ...must, [key]: v })}
                      hint={isOpen(value) ? "Pick a specific answer to make it a requirement." : "Unmarked answers can flex a little for a better fit."}
                    />
                  </div>
                )}
              </Panel>

              <SessionBar
                services={services}
                mustServices={!!must.services}
                setMustServices={(v) => setMust({ ...must, services: v })}
                includeRewatches={includeRewatches}
                setIncludeRewatches={setIncludeRewatches}
                watchedCount={taste.watched.length}
              />

              <div className="mt-6 flex items-center justify-between gap-3">
                <SecondaryButton onClick={() => (step === 0 ? go("home") : setStep(step - 1))}>Back</SecondaryButton>
                <PrimaryButton disabled={!value.length} onClick={() => (last ? run([], NO_ADJUSTMENTS) : setStep(step + 1))}>
                  {last ? "Find my movie" : isCore ? "Next" : "Next refinement"}
                </PrimaryButton>
              </div>
            </div>
          );
        })()}

        {view === "nearmiss" && result?.kind === "nearmiss" && (
          <div className="mx-auto max-w-2xl">
            <Heading eyebrow="Almost" title="Nothing checks every Must have" />
            <Panel className="space-y-4">
              <p>
                The closest movie in the sample catalog fits most of your answers, but {result.misses.join("; ")}.
              </p>
              <p className="text-plum">Want to see it anyway? I won&apos;t show the title unless you say so.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <PrimaryButton onClick={revealNearMiss}>Show me anyway</PrimaryButton>
                <SecondaryButton onClick={adjustAnswers}>Adjust my answers</SecondaryButton>
              </div>
            </Panel>
          </div>
        )}

        {view === "empty" && (
          <div className="mx-auto max-w-2xl">
            <Heading eyebrow="No more picks" title="I've run out of sample movies for these answers" subtitle="Every title that fits has been shown or is marked watched." />
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton onClick={adjustAnswers}>Adjust my answers</PrimaryButton>
              {!includeRewatches && taste.watched.length > 0 && (
                <SecondaryButton onClick={() => { setIncludeRewatches(true); setStep(0); go("questions"); }}>Include rewatches</SecondaryButton>
              )}
            </div>
          </div>
        )}

        {view === "pick" && result?.kind === "pick" && (
          <div>
            <Heading eyebrow="Tonight's pick" title="Here's your movie" />
            <MovieCard movie={result.movie} services={services} rationale={result.rationale}>
              <WatchLink movie={result.movie} services={services} onWatch={(s) => watch(result.movie, s)} />
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => go("reject")}>Not this one</SecondaryButton>
                {canNotify(result.movie, services) && <SecondaryButton onClick={() => notify(result.movie.id)}>Notify me</SecondaryButton>}
                {user ? (
                  <span className="inline-flex min-h-11 items-center text-[14px] text-plum">✓ Saved to your history</span>
                ) : (
                  <TextButton onClick={() => askForAccount({ kind: "save-pick" })}>Save to history</TextButton>
                )}
              </div>
            </MovieCard>
          </div>
        )}

        {view === "reject" && pick && (
          <div className="mx-auto max-w-2xl">
            <Heading eyebrow="One quick question" title="Not the one? What missed the mark?" subtitle={`I'll keep your answers and skip ${pick.title}.`} />
            <div className="grid gap-2 sm:grid-cols-2">
              {REJECT_REASONS.map((r) => (
                <SecondaryButton key={r.id} onClick={() => reject(r.id)} className="justify-start">{r.label}</SecondaryButton>
              ))}
            </div>
            <TextButton className="mt-4" onClick={() => go("pick")}>Never mind, go back</TextButton>
          </div>
        )}

        {view === "random" && (
          <div>
            <Heading
              eyebrow="Random pick"
              title="Feeling lucky?"
              subtitle={randomPersonal ? "Picked from your saved taste and services. No questions asked." : "A broad sample pick. Add services and favorites in setup for a more personal one."}
            />
            <div className="mb-4">
              <Toggle
                label="Include rewatches"
                checked={includeRewatches}
                onChange={setIncludeRewatches}
                hint={taste.watched.length ? `${taste.watched.length} watched titles are skipped unless this is on.` : "Watched titles are skipped by default."}
              />
            </div>
            {randomId ? (
              <MovieCard movie={movieById(randomId)} services={services}>
                <WatchLink movie={movieById(randomId)} services={services} onWatch={(s) => watch(movieById(randomId), s)} />
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton onClick={rollRandom}>Another random pick</PrimaryButton>
                  {canNotify(movieById(randomId), services) && <SecondaryButton onClick={() => notify(randomId)}>Notify me</SecondaryButton>}
                </div>
              </MovieCard>
            ) : (
              <Panel>
                <p>Nothing left to pick from. Try turning on Include rewatches.</p>
                <PrimaryButton className="mt-4" onClick={rollRandom}>Try again</PrimaryButton>
              </Panel>
            )}
          </div>
        )}

        {view === "trending" && (
          <div>
            <Heading eyebrow="Top 5 trending" title="What everyone's renting this week" subtitle="Across all services, including ones you don't have." />
            <p className="mb-4"><SampleTag>Sample trending data: not a live ranking and not personalized</SampleTag></p>
            <ol className="space-y-3">
              {TRENDING_IDS.map((id, i) => {
                const m = movieById(id);
                return (
                  <li key={id}>
                    <Panel className="flex gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-display text-2xl text-brick">#{i + 1}</span>
                        <Poster movie={m} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <h2 className="font-display text-[22px] leading-tight">{m.title}</h2>
                        <p className="text-[14px] text-plum">{m.year} · {m.runtime} min · Rated {m.rating} · ★ {m.score.toFixed(1)} sample score</p>
                        <p className="text-[14px]">
                          {m.availability.map((a) => `${serviceById(a.service).name} (${a.type === "subscription" ? "subscription" : a.type === "free" ? "free with ads" : "rent"})`).join(" · ")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <SecondaryButton onClick={() => setDetailsId(id)}>Details</SecondaryButton>
                          {canNotify(m, services) && <SecondaryButton onClick={() => notify(id)}>Notify me</SecondaryButton>}
                        </div>
                      </div>
                    </Panel>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {view === "alerts" && (
          <AlertsPage
            user={user}
            services={services}
            onboarded={onboarded}
            alerts={alerts}
            draft={draftAlert}
            setDraft={setDraftAlert}
            onCreate={(movieId, delivery) => {
              if (!user) return askForAccount({ kind: "alert", movieId });
              setAlerts([{ id: nextId++, movieId, delivery, services: paidServices(services) }, ...alerts]);
              setDraftAlert(null);
            }}
            onRemove={(id) => setAlerts(alerts.filter((a) => a.id !== id))}
            onSetup={() => { setOnboardStep(user ? "services" : "account"); go("onboarding"); }}
            onDetails={setDetailsId}
            onWatch={watch}
          />
        )}

        {view === "history" && (
          <div>
            <Heading eyebrow="History" title="Your movies" subtitle="Recommendations, Watch handoffs, and your own ratings." />
            {!user ? (
              <Panel className="space-y-3">
                <p>History saves to an account. Create one and anything you&apos;ve seen tonight comes along.</p>
                <PrimaryButton onClick={() => { setPending(null); go("account"); }}>Create account</PrimaryButton>
              </Panel>
            ) : (
              <HistoryList
                log={log}
                watched={taste.watched}
                myRatings={myRatings}
                onToggleWatched={(id) => setMarkedWatched((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))}
                importedWatched={imported?.watched ?? []}
                onRate={(id, n) => setMyRatings({ ...myRatings, [id]: n })}
                onFind={startFlow}
              />
            )}
          </div>
        )}
      </main>

      {detailsId && (
        <div role="dialog" aria-modal="true" aria-label={movieById(detailsId).title} className="fixed inset-0 z-40 overflow-y-auto bg-teal/60 p-4" onClick={() => setDetailsId(null)}>
          <div className="mx-auto my-8 max-w-3xl bg-ivory rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <MovieCard movie={movieById(detailsId)} services={services}>
              <WatchLink movie={movieById(detailsId)} services={services} onWatch={(s) => watch(movieById(detailsId), s)} />
              <div className="flex flex-wrap gap-2">
                {canNotify(movieById(detailsId), services) && <SecondaryButton onClick={() => notify(detailsId)}>Notify me</SecondaryButton>}
                <SecondaryButton onClick={() => setDetailsId(null)}>Close</SecondaryButton>
              </div>
            </MovieCard>
          </div>
        </div>
      )}

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-teal/15 bg-ivory md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <button
              key={n.view}
              type="button"
              aria-current={navActive(n.view) ? "page" : undefined}
              onClick={() => (n.view === "random" ? openRandom() : go(n.view))}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[13px] font-medium ${navActive(n.view) ? "bg-cream text-teal" : "text-teal/80"}`}
            >
              <Icon name={n.icon} />
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ---------- Pieces ----------

function AccountControl({ user, onSignIn, onHistory, onSignOut }: { user: string | null; onSignIn: () => void; onHistory: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  if (!user) return <SecondaryButton onClick={onSignIn}>Sign in</SecondaryButton>;
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-plum font-medium text-ivory"
      >
        V
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-teal/15 bg-ivory p-2 shadow-lg">
          <p className="px-3 py-2 text-[13px] text-plum">{user} (sample)</p>
          <button type="button" className="block min-h-11 w-full rounded-lg px-3 text-left hover:bg-sand" onClick={() => { setOpen(false); onHistory(); }}>History</button>
          <button type="button" className="block min-h-11 w-full rounded-lg px-3 text-left hover:bg-sand" onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function Progress({ step, steps }: { step: number; steps: QuestionKey[] }) {
  const isCore = step < CORE.length;
  const refinements = steps.length - CORE.length;
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden>
        {CORE.map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-teal" : "bg-teal/15"}`} />
        ))}
      </div>
      <p className="mt-2 text-[14px] font-medium text-plum" aria-live="polite">
        {isCore
          ? `Question ${step + 1} of 3`
          : `Optional refinement ${step - CORE.length + 1} of ${refinements}`}
      </p>
    </div>
  );
}

function SessionBar(props: {
  services: ServiceId[];
  mustServices: boolean;
  setMustServices: (v: boolean) => void;
  includeRewatches: boolean;
  setIncludeRewatches: (v: boolean) => void;
  watchedCount: number;
}) {
  return (
    <Panel className="mt-4 space-y-2 bg-sand/60">
      <p className="text-[14px] font-medium text-plum">Tonight&apos;s session</p>
      <p className="text-[15px]">
        Services:{" "}
        {props.services.length ? props.services.map((s) => serviceById(s).name).join(", ") : "none selected, so I'll show every way to watch"}
      </p>
      <div className="flex flex-wrap gap-x-6">
        {props.services.length > 0 && (
          <Toggle label="Services are a Must have" checked={props.mustServices} onChange={props.setMustServices} />
        )}
        <Toggle
          label="Include rewatches"
          checked={props.includeRewatches}
          onChange={props.setIncludeRewatches}
          hint={props.watchedCount ? `${props.watchedCount} watched titles skipped when off` : undefined}
        />
      </div>
    </Panel>
  );
}

function Onboarding(props: {
  step: OnboardStep;
  setStep: (s: OnboardStep) => void;
  user: string | null;
  onSignIn: () => void;
  services: ServiceId[];
  setServices: (s: ServiceId[]) => void;
  imported: Import | null;
  setImported: (i: Import | null) => void;
  favorites: string[];
  setFavorites: (f: string[]) => void;
  pending: Pending | null;
  onFinish: () => void;
  onFind: () => void;
  onSkipAll: () => void;
}) {
  const { step, setStep, user, services, setServices, favorites, setFavorites } = props;
  const [username, setUsername] = useState(props.imported?.username ?? "");
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>(favorites);
  const order: OnboardStep[] = ["account", "services", "letterboxd", "favorites", "finish"];
  const idx = order.indexOf(step);
  const next = () => setStep(order[idx + 1]);
  const handle = username.trim().replace(/^https?:\/\/(www\.)?letterboxd\.com\//, "").replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-[14px] font-medium text-plum">Setup · step {idx + 1} of {order.length} · all optional</p>

      {step === "account" && (
        <>
          <Heading title="Start with taste" subtitle="All setup is optional. Skip it and try recommendations right away." />
          <Panel className="space-y-3">
            <p>An account saves your favorites, history, and alerts.</p>
            <SampleTag>Sample account: no real sign-in happens</SampleTag>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton onClick={() => { props.onSignIn(); next(); }}>Create sample account</PrimaryButton>
              <SecondaryButton onClick={next}>Continue as guest</SecondaryButton>
              <TextButton onClick={props.onSkipAll}>Skip setup</TextButton>
            </div>
          </Panel>
        </>
      )}

      {step === "services" && (
        <>
          <Heading title="Which services do you have?" subtitle="I'll favor movies you can already watch. US region." />
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <Chip key={s.id} selected={services.includes(s.id)} onClick={() => setServices(services.includes(s.id) ? services.filter((x) => x !== s.id) : [...services, s.id])}>
                {s.name}{s.free && <span className="text-[13px] text-plum">· free with ads</span>}
              </Chip>
            ))}
          </div>
          <StepButtons onNext={next} nextLabel="Next" onSkip={() => { setServices([]); next(); }} />
        </>
      )}

      {step === "letterboxd" && (
        <>
          <Heading title="Bring your Letterboxd taste" subtitle="Ratings, watched history, and watchlist help me rank picks." />
          <Panel className="space-y-4">
            <SampleTag>Sample import: the preview shows illustrative data, not your real account</SampleTag>
            {props.imported ? (
              <p>✓ Imported a sample profile for <b>{props.imported.username}</b>: {Object.keys(props.imported.ratings).length} ratings, {props.imported.watched.length} watched, {props.imported.watchlist.length} on the watchlist.</p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-[15px] font-medium">Letterboxd username or profile link</span>
                  <input value={username} onChange={(e) => { setUsername(e.target.value); setPreview(false); }} placeholder="e.g. moviebuff or letterboxd.com/moviebuff" className={inputClass} />
                </label>
                {!preview ? (
                  <SecondaryButton disabled={!handle} onClick={() => setPreview(true)}>Preview sample import</SecondaryButton>
                ) : (
                  <div className="space-y-3 rounded-xl border-2 border-dashed border-plum/40 p-4">
                    <p className="font-medium">Preview for {handle} (sample)</p>
                    <PreviewList title="Ratings" items={Object.entries(SAMPLE_IMPORT.ratings).map(([id, n]) => `${movieById(id).title}: ${n}★`)} />
                    <PreviewList title="Watched" items={SAMPLE_IMPORT.watched.map((id) => movieById(id).title)} />
                    <PreviewList title="Watchlist" items={SAMPLE_IMPORT.watchlist.map((id) => movieById(id).title)} />
                    {!user && <p className="text-[14px] text-plum">Saving an import needs an account.</p>}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <PrimaryButton onClick={() => { if (!user) props.onSignIn(); props.setImported({ username: handle, ...SAMPLE_IMPORT }); }}>
                        {user ? "Confirm import" : "Create account and confirm"}
                      </PrimaryButton>
                      <SecondaryButton onClick={() => setPreview(false)}>Cancel</SecondaryButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </Panel>
          <StepButtons onNext={next} nextLabel="Next" onSkip={next} />
        </>
      )}

      {step === "favorites" && (
        <>
          <Heading title="Up to five all-time favorites" subtitle="No ranking, and no need to fill every slot." />
          <Panel className="space-y-4">
            <div className="flex flex-wrap gap-2" aria-live="polite">
              {picked.length === 0 && <p className="text-plum">No favorites picked yet.</p>}
              {picked.map((id) => (
                <span key={id} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-teal bg-cream pl-4 pr-1 text-[15px] font-medium">
                  {movieById(id).title}
                  <button type="button" aria-label={`Remove ${movieById(id).title}`} onClick={() => setPicked(picked.filter((x) => x !== id))} className="h-9 w-9 rounded-full hover:bg-ivory">×</button>
                </span>
              ))}
            </div>
            <p className="text-[14px] text-plum">{picked.length} of 5 picked</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the sample catalog" aria-label="Search movies" className={inputClass} />
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {MOVIES.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())).map((m) => {
                const on = picked.includes(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={!on && picked.length >= 5}
                      onClick={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])}
                      className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-sand disabled:opacity-40"
                    >
                      <span>{m.title} <span className="text-[13px] text-plum">({m.year})</span></span>
                      <span className="text-[14px] font-medium">{on ? "✓ Picked" : "Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!user && picked.length > 0 && <p className="text-[14px] text-plum">Saving favorites needs an account.</p>}
          </Panel>
          <StepButtons
            onNext={() => { if (picked.length && !user) props.onSignIn(); setFavorites(picked); next(); }}
            nextLabel={picked.length ? (user ? "Save favorites" : "Create account and save") : "Next"}
            onSkip={() => { setPicked([]); setFavorites([]); next(); }}
          />
        </>
      )}

      {step === "finish" && (
        <>
          <Heading title="You're all set" subtitle="Here's what I'll use. Editing these comes in a later version." />
          <Panel className="space-y-3">
            <SummaryRow label="Services" value={services.length ? services.map((s) => serviceById(s).name).join(", ") : "Skipped: I'll show every way to watch"} />
            <SummaryRow label="Letterboxd" value={props.imported ? `${props.imported.username} (sample import)` : "Skipped"} />
            <SummaryRow label="Favorites" value={favorites.length ? favorites.map((id) => movieById(id).title).join(", ") : "Skipped"} />
            <SummaryRow label="Account" value={user ? `${user} (sample)` : "Guest"} />
          </Panel>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {props.pending ? (
              <PrimaryButton onClick={props.onFinish}>Pick up where you left off</PrimaryButton>
            ) : (
              <>
                <PrimaryButton onClick={props.onFind}>Find tonight&apos;s movie</PrimaryButton>
                <SecondaryButton onClick={props.onFinish}>Go to Home</SecondaryButton>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StepButtons({ onNext, nextLabel, onSkip }: { onNext: () => void; nextLabel: string; onSkip: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <TextButton onClick={onSkip}>Skip</TextButton>
      <PrimaryButton onClick={onNext}>{nextLabel}</PrimaryButton>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[14px] font-medium text-plum">{title} ({items.length})</p>
      <p className="text-[15px]">{items.join(" · ")}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
      <span className="font-medium text-plum">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AlertsPage(props: {
  user: string | null;
  services: ServiceId[];
  onboarded: boolean;
  alerts: Alert[];
  draft: { movieId: string; delivery: Delivery } | null;
  setDraft: (d: { movieId: string; delivery: Delivery } | null) => void;
  onCreate: (movieId: string, delivery: Delivery) => void;
  onRemove: (id: number) => void;
  onSetup: () => void;
  onDetails: (id: string) => void;
  onWatch: (movie: Movie, service: ServiceId) => void;
}) {
  const { services, draft, setDraft } = props;
  const [query, setQuery] = useState("");
  const paid = paidServices(services);
  const results = query.trim() ? MOVIES.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];
  const draftMovie = draft ? movieById(draft.movieId) : null;
  const includedOn = draftMovie?.availability.find((a) => a.type === "subscription" && paid.includes(a.service));

  // Example states use the viewer's own paid services when possible.
  const examplePaid: ServiceId[] = paid.length ? paid : ["netflix", "hbo"];
  const notIncluded = (m: Movie) => !m.availability.some((a) => a.type === "subscription" && examplePaid.includes(a.service));
  const waitingExample = MOVIES.find((m) => TRENDING_IDS.includes(m.id) && notIncluded(m)) ?? MOVIES.find(notIncluded) ?? MOVIES[0];
  const availableExample = MOVIES.find((m) => m.id !== waitingExample.id && m.availability.some((a) => a.type === "subscription" && a.service === examplePaid[0]))!;

  return (
    <div className="space-y-8">
      <Heading eyebrow="Alerts" title="Tell me when it's on my services" subtitle="An alert tracks one movie becoming included with a paid subscription you selected. Rentals and Tubi don't count." />

      <section>
        <label className="block">
          <span className="mb-1 block font-medium">Search for a movie</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the sample catalog" className={inputClass} />
        </label>
        {query.trim() && (
          <ul className="mt-2 space-y-1">
            {results.length === 0 && <li className="text-plum">No movies match &ldquo;{query}&rdquo; in the sample catalog.</li>}
            {results.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { setDraft({ movieId: m.id, delivery: draft?.delivery ?? "both" }); setQuery(""); }} className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-sand">
                  <span>{m.title} <span className="text-[13px] text-plum">({m.year})</span></span>
                  <span className="text-[14px] font-medium">Select</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draftMovie && draft && (
        <Panel className="space-y-4">
          <div className="flex gap-4">
            <Poster movie={draftMovie} size="sm" />
            <div>
              <p className="text-[14px] font-medium text-plum">New alert</p>
              <h2 className="font-display text-[22px]">{draftMovie.title}</h2>
              <TextButton onClick={() => props.onDetails(draftMovie.id)}>Movie details</TextButton>
            </div>
          </div>
          {includedOn ? (
            <p>Good news: it&apos;s already included with {serviceById(includedOn.service).name} (sample availability). No alert needed.</p>
          ) : paid.length === 0 ? (
            <div className="space-y-3">
              <p>Alerts need at least one paid subscription so I know when one applies. {props.onboarded ? "Services are chosen during setup; editing them comes in a later version." : "You can add services in setup."}</p>
              {!props.onboarded && <SecondaryButton onClick={props.onSetup}>Set up services</SecondaryButton>}
            </div>
          ) : (
            <>
              <p className="text-[15px]">Watching your paid services: {paid.map((s) => serviceById(s).name).join(", ")}</p>
              <fieldset>
                <legend className="mb-2 font-medium">How should I let you know?</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DELIVERY_LABEL) as Delivery[]).map((d) => (
                    <Chip key={d} selected={draft.delivery === d} onClick={() => setDraft({ ...draft, delivery: d })}>{DELIVERY_LABEL[d]}</Chip>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={() => props.onCreate(draft.movieId, draft.delivery)}>{props.user ? "Create alert" : "Create account and save alert"}</PrimaryButton>
                <SecondaryButton onClick={() => setDraft(null)}>Cancel</SecondaryButton>
              </div>
            </>
          )}
        </Panel>
      )}

      {props.alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px]">Your alerts</h2>
          {props.alerts.map((a) => (
            <AlertCard key={a.id} movie={movieById(a.movieId)} paid={a.services} delivery={a.delivery} state="waiting" onRemove={() => props.onRemove(a.id)} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[22px]">What alerts look like</h2>
          <SampleTag>Examples: no real monitoring or delivery</SampleTag>
        </div>
        <AlertCard movie={waitingExample} paid={examplePaid} delivery="both" state="waiting" />
        <AlertCard movie={availableExample} paid={examplePaid} delivery="both" state="available" availableOn={examplePaid[0]} onWatch={props.onWatch} />
      </section>
    </div>
  );
}

function AlertCard({ movie, paid, delivery, state, availableOn, onRemove, onWatch }: {
  movie: Movie; paid: ServiceId[]; delivery: Delivery; state: "waiting" | "available"; availableOn?: ServiceId;
  onRemove?: () => void; onWatch?: (movie: Movie, service: ServiceId) => void;
}) {
  return (
    <Panel className="flex gap-4">
      <Poster movie={movie} size="sm" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl">{movie.title}</h3>
          {state === "waiting" ? (
            <span className="rounded-full border-2 border-teal/30 px-2.5 text-[13px] font-medium">◷ Waiting</span>
          ) : (
            <span className="rounded-full bg-plum px-2.5 text-[13px] font-medium text-ivory">● Available now</span>
          )}
        </div>
        <p className="text-[14px] text-plum">Watching: {paid.map((s) => serviceById(s).name).join(", ")} · Delivery: {DELIVERY_LABEL[delivery]}</p>
        {state === "waiting" ? (
          <p className="text-[15px]">Not included on your paid services yet. I&apos;ll let you know if that changes.</p>
        ) : (
          <>
            <div className="rounded-xl border-l-4 border-brick bg-cream/40 p-3 text-[15px]">
              <p className="font-medium text-plum">🔔 Sample notification</p>
              <p>{movie.title} is now included with {serviceById(availableOn!).name}.</p>
            </div>
            <WatchLink movie={movie} services={[availableOn!]} onWatch={(s) => onWatch?.(movie, s)} />
          </>
        )}
        {onRemove && <TextButton onClick={onRemove}>Remove alert</TextButton>}
      </div>
    </Panel>
  );
}

function HistoryList(props: {
  log: LogEntry[];
  watched: string[];
  importedWatched: string[];
  myRatings: Record<string, number>;
  onToggleWatched: (id: string) => void;
  onRate: (id: string, n: number) => void;
  onFind: () => void;
}) {
  const movieIds = [...new Set(props.log.map((e) => e.movieId))];
  if (!movieIds.length)
    return (
      <Panel className="space-y-3">
        <p>Nothing here yet. Your first pick is three questions away.</p>
        <PrimaryButton onClick={props.onFind}>Find tonight&apos;s movie</PrimaryButton>
      </Panel>
    );
  return (
    <ul className="space-y-3">
      {movieIds.map((id) => {
        const m = movieById(id);
        const events = props.log.filter((e) => e.movieId === id);
        const watched = props.watched.includes(id);
        return (
          <li key={id}>
            <Panel className="flex gap-4">
              <Poster movie={m} size="sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="font-display text-xl">{m.title}</h2>
                <ul className="text-[14px] text-plum">
                  {events.map((e) => <li key={e.id}>{e.at} · {e.event}</li>)}
                </ul>
                <p className="text-[14px]">Audience: ★ {m.score.toFixed(1)} / 5 <span className="text-plum">(sample)</span></p>
                <div className="flex flex-wrap items-center gap-x-6">
                  <Toggle
                    label="Watched"
                    checked={watched}
                    disabled={props.importedWatched.includes(id)}
                    hint={props.importedWatched.includes(id) ? "From your Letterboxd sample import" : undefined}
                    onChange={() => props.onToggleWatched(id)}
                  />
                  <div>
                    <p className="text-[14px] font-medium">Your rating</p>
                    <Stars label={`Your rating for ${m.title}`} value={props.myRatings[id]} onChange={(n) => props.onRate(id, n)} />
                  </div>
                </div>
              </div>
            </Panel>
          </li>
        );
      })}
    </ul>
  );
}
