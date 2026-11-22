import Link from "next/link";
import type { Credit } from "@/lib/artist-source";
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

/** Every credited artist as its own link ("gyuris & Susa" → two links); the text between stays plain. */
export function ArtistCredits({ credits, className = "" }: { credits: Credit[]; className?: string }) {
  return credits.map((c, i) =>
    c.id ? (
      <Link key={i} href={`/artist/${c.id}`} className={`transition hover:text-white ${className}`}>
        {c.text}
      </Link>
    ) : (
      <span key={i}>{c.text}</span>
    ),
  );
}
