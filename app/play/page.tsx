import { Suspense } from "react";
import { PlayFromParams } from "./PlayFromParams";

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-neutral-950" />}>
      <PlayFromParams />
    </Suspense>
  );
}
