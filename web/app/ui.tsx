import { availabilityLabel, fmtRuntime, watchOptions } from "./engine";
import { serviceById, type Movie, type ServiceId } from "./movies";

export function Heading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-widest text-plum">{eyebrow}</p>}
      <h1 className="font-display text-[28px] leading-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 text-plum">{subtitle}</p>}
    </header>
  );
}

export function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-2xl border border-teal/15 bg-white/60 p-4 md:p-6 ${className}`}>{children}</section>;
}

// Small ticket-stub label that marks illustrative data.
export function SampleTag({ children = "Sample data" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-plum/50 bg-cream/40 px-2 py-0.5 text-[13px] font-medium text-plum">
      {children}
    </span>
  );
}

export function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-[15px] font-medium transition disabled:opacity-40 ${
        selected ? "border-teal bg-cream text-teal" : "border-teal/20 bg-ivory text-teal hover:border-teal/50"
      }`}
    >
      {selected && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}

export function Toggle({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-3 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-teal transition ${checked ? "bg-teal" : "bg-ivory"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${checked ? "left-[22px] bg-cream" : "left-0.5 bg-teal/60"}`} />
      </button>
      <span className="text-[15px] font-medium">
        {label} <span className="font-normal text-plum">{checked ? "(on)" : "(off)"}</span>
        {hint && <span className="block text-[13px] font-normal text-plum">{hint}</span>}
      </span>
    </label>
  );
}

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export function PrimaryButton({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${btn} bg-teal text-ivory hover:bg-teal/90 ${className}`} />;
}

export function SecondaryButton({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${btn} border-2 border-teal/25 bg-ivory text-teal hover:border-teal ${className}`} />;
}

export function TextButton({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`min-h-11 px-1 text-[15px] font-medium text-teal underline underline-offset-4 hover:text-plum ${className}`} />;
}

export const inputClass =
  "min-h-11 w-full rounded-xl border-2 border-teal/25 bg-ivory px-4 text-base text-teal placeholder:text-teal/50 focus:border-teal focus:outline-none";

// Generated poster: palette gradient with a VHS-style label. No real artwork.
const POSTERS = [
  "from-teal to-plum",
  "from-plum to-brick",
  "from-teal to-[#0e2a2f]",
  "from-brick to-plum",
  "from-[#2a5a61] to-teal",
];

export function Poster({ movie, size = "lg" }: { movie: Movie; size?: "sm" | "lg" }) {
  const small = size === "sm";
  return (
    <div
      aria-hidden
      className={`relative flex shrink-0 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br ${POSTERS[movie.poster % POSTERS.length]} ${
        small ? "h-24 w-16 p-1.5" : "aspect-[2/3] w-full max-w-48 p-3"
      }`}
    >
      <div className="flex gap-1">
        <span className="h-1 flex-1 rounded-full bg-cream/80" />
        <span className="h-1 w-1/4 rounded-full bg-brick" />
      </div>
      <div className={`rounded-md bg-ivory/95 text-teal ${small ? "px-1 py-0.5" : "px-2 py-1.5"}`}>
        <p className={`font-display leading-tight ${small ? "text-[9px]" : "text-base"}`}>{movie.title}</p>
        {!small && <p className="mt-0.5 text-[11px] uppercase tracking-widest text-plum">{movie.year} · CineMatch video</p>}
      </div>
    </div>
  );
}

export function Meta({ movie }: { movie: Movie }) {
  return (
    <p className="text-[14px] text-plum">
      {movie.year} · {fmtRuntime(movie.runtime)} · Rated {movie.rating} · {movie.genres.join(", ")}
      <br />
      <span className="font-medium">★ {movie.score.toFixed(1)} / 5</span> sample audience score
    </p>
  );
}

export function AvailabilityList({ movie, services }: { movie: Movie; services: ServiceId[] }) {
  return (
    <ul className="space-y-1.5">
      {watchOptions(movie, services).map((a) => (
        <li key={a.service + a.type} className="flex flex-wrap items-center gap-x-2 text-[14px]">
          <span className="font-medium">{serviceById(a.service).name}</span>
          <span className="text-plum">· {availabilityLabel(a)}</span>
          {services.includes(a.service) && a.type !== "rent" && (
            <span className="rounded-full bg-cream px-2 text-[13px] font-medium">Your service</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Watch hands off to the service's home page in a new tab; it never claims a movie-level link.
export function WatchLink({ movie, services, onWatch }: { movie: Movie; services: ServiceId[]; onWatch: (service: ServiceId) => void }) {
  const best = watchOptions(movie, services)[0];
  const service = serviceById(best.service);
  return (
    <div>
      <a
        href={service.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onWatch(best.service)}
        className={`${btn} w-full bg-teal text-ivory hover:bg-teal/90 sm:w-auto`}
      >
        {best.type === "rent" ? "Rent" : "Watch"} on {service.name} <span aria-hidden>↗</span>
      </a>
      <p className="mt-1.5 text-[13px] text-plum">
        Opens {service.name}&apos;s website in a new tab. Availability is sample data; search for the title there.
      </p>
    </div>
  );
}

export function MovieCard({ movie, services, children, rationale }: { movie: Movie; services: ServiceId[]; children?: React.ReactNode; rationale?: string }) {
  return (
    <Panel className="grid gap-5 sm:grid-cols-[12rem_1fr]">
      <Poster movie={movie} />
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl leading-tight md:text-3xl">{movie.title}</h2>
          <Meta movie={movie} />
        </div>
        <p>{movie.synopsis}</p>
        {rationale && (
          <div className="rounded-xl border-l-4 border-brick bg-cream/40 p-3 text-[15px]">
            <p className="font-medium text-plum">Why this one</p>
            <p>{rationale}</p>
          </div>
        )}
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[14px] font-medium">
            Where to watch (US) <SampleTag />
          </p>
          <AvailabilityList movie={movie} services={services} />
        </div>
        {children}
      </div>
    </Panel>
  );
}

export function Stars({ value, onChange, label }: { value?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={`flex h-11 w-9 items-center justify-center text-2xl ${value && n <= value ? "text-brick" : "text-teal/25"}`}
        >
          ★
        </button>
      ))}
      <span className="ml-1 text-[14px] text-plum">{value ? `${value} of 5` : "Not rated"}</span>
    </div>
  );
}

const ICONS: Record<string, string> = {
  home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  random: "M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.5M17 7h3m0 0-2-2m2 2-2 2m2 8-2-2m2 2-2 2M13.1 9.5C14.2 8 15.4 7 17 7",
  trending: "M3 17 9 11l4 4 8-8m0 0h-6m6 0v6",
  alerts: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
};

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}
