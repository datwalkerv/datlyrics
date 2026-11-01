import Link from "next/link";
import { withoutFeat } from "@/lib/clean-title";

/** Like the player's artist line: opens the artist's page (a "feat." credit goes to the main artist). */
export function ArtistLink({ name, className = "" }: { name: string; className?: string }) {
  return (
    <Link href={`/artist/${encodeURIComponent(withoutFeat(name))}`} className={`transition hover:text-white ${className}`}>
      {name}
    </Link>
  );
}
