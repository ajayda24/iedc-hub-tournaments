import type { Metadata } from "next";
import { common } from "@iedc/data/copy/common";
import { PracticeApp } from "@/screens/PracticeApp";

export const metadata: Metadata = { title: common.pageTitles.practice };

export default function PracticePage() {
  return <PracticeApp />;
}
