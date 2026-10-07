import type { Metadata } from "next";
import { ScreenApp } from "@/screens/ScreenApp";

export const metadata: Metadata = { title: "Big screen" };

export default function ScreenPage() {
  return <ScreenApp />;
}
