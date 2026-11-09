import type { Metadata } from "next";
import Link from "next/link";
import { Heading, Panel } from "../ui";

export const metadata: Metadata = { title: "About · CineMatch" };

// CM-02: TMDB's terms require this notice, and streaming data needs a JustWatch credit.
export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Heading eyebrow="About" title="About CineMatch" subtitle="One movie worth watching tonight, with a reason why." />
      <div className="space-y-4">
        <Panel>
          <h2 className="mb-2 font-display text-xl">Movie data</h2>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          <p className="mt-2">
            Movie details, ratings, and posters come from{" "}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="underline">The Movie Database (TMDB)</a>.
          </p>
        </Panel>
        <Panel>
          <h2 className="mb-2 font-display text-xl">Where to watch</h2>
          <p>
            Streaming availability is provided by{" "}
            <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer" className="underline">JustWatch</a>.
          </p>
        </Panel>
        <Panel>
          <p className="text-plum">CineMatch is a non-commercial class project by Chris, Findley, JD, and Thomas.</p>
        </Panel>
      </div>
      <Link href="/" className="mt-6 inline-block underline">Back to CineMatch</Link>
    </main>
  );
}
