import Link from "next/link";
import { withoutFeat } from "@/lib/clean-title";

/**
 * Like the player's artist line: opens the artist's page (a "feat." credit goes to the main artist).
 * `linkTo`: the artist to open when `name` credits several ("A & B").
 */
export function ArtistLink({ name, linkTo = name, className = "" }: { name: string; linkTo?: string; className?: string }) {
  return (
    <Link href={`/artist/${encodeURIComponent(withoutFeat(linkTo))}`} className={`transition hover:text-white ${className}`}>
      {name}
    </Link>
  );
}
