"use client";

import { useEffect } from "react";

type Props = { type: "home" } | { type: "article"; itemId: string };

// Fires once on mount, client-side, after hydration — keeps the server
// render of page.tsx/article/[id]/page.tsx free of any write.
export default function ViewTracker(props: Props) {
  useEffect(() => {
    navigator.sendBeacon?.("/api/views", JSON.stringify(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
