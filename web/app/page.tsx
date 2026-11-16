import { Suspense } from "react";
import { getViewer } from "@/lib/supabase-server";
import CineMatch from "./cinematch";

export default function Home() {
  return (
    <Suspense>
      <App />
    </Suspense>
  );
}

// Reads the login cookie, so it renders per request inside the boundary above.
async function App() {
  return <CineMatch viewer={await getViewer()} />;
}
