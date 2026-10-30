import type { Metadata } from "next";
import { HomeView } from "./HomeView";

export const metadata: Metadata = { title: "Home · datlyrics" };

export default function HomePage() {
  return <HomeView />;
}
