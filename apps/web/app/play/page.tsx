import type { Metadata } from "next";
import { PlayApp } from "@/screens/PlayApp";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return <PlayApp />;
}
