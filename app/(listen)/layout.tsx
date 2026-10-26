import { Suspense } from "react";
import { PlayerHost } from "./PlayerHost";

export default function ListenLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <PlayerHost />
      </Suspense>
      {children}
    </>
  );
}
