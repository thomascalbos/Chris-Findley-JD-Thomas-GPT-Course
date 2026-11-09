import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getViewerEmail } from "@/lib/supabase-server";
import CineMatch from "../cinematch";
import { URL_VIEWS } from "../views";

export function generateStaticParams() {
  return URL_VIEWS.map((view) => ({ view }));
}

// Screens with their own address, like /alerts. proxy.ts sends logged-out visitors to /login first.
export default function ViewPage({ params }: PageProps<"/[view]">) {
  return (
    <Suspense>
      <App params={params} />
    </Suspense>
  );
}

// Reads the login cookie, so it renders per request inside the boundary above.
async function App({ params }: { params: PageProps<"/[view]">["params"] }) {
  const { view } = await params;
  const match = URL_VIEWS.find((v) => v === view);
  if (!match) notFound();
  // CM-05 is deliberately account-free and must not depend on Supabase being
  // configured just to render its sample experience.
  return <CineMatch userEmail={match === "tutorial" ? null : await getViewerEmail()} initialView={match} />;
}
