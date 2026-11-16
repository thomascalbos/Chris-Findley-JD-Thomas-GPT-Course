'use client'

// Live "N movies fit so far" line under each quiz question (CM-09).

import { useEffect, useRef, useState } from "react";
import { countMatches, type QuizFilter } from "./quiz-filter";

export function MatchCount({ filter, onServices }: { filter: QuizFilter; onServices: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0); // ignores counts for answers the viewer has already changed
  const key = JSON.stringify(filter);

  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(() => {
      countMatches(JSON.parse(key)).then(
        (n) => { if (id === latest.current) { setCount(n); setFailed(false); } },
        () => { if (id === latest.current) setFailed(true); },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [key]);

  if (failed) return null; // the count is a nice-to-have; the quiz works without it
  return (
    <p role="status" className="mt-4 text-[14px] text-plum">
      {count === null ? (
        "Counting matching movies…"
      ) : count === 0 ? (
        "No movie fits every answer so far. Answers without Must have can flex, so you'll still get a pick."
      ) : (
        <>
          <span className="font-medium text-teal">{count.toLocaleString()} {count === 1 ? "movie fits" : "movies fit"}</span> your answers so far
          {onServices ? " on your services" : ""}.
        </>
      )}
    </p>
  );
}
