import type { Metadata } from "next";
import { PracticeApp } from "@/screens/PracticeApp";

export const metadata: Metadata = { title: "Practice" };

export default function PracticePage() {
  return <PracticeApp />;
}
