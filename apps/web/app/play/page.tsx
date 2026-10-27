import type { Metadata } from "next";
import { common } from "@iedc/config/copy/common";
import { PlayApp } from "@/screens/PlayApp";

export const metadata: Metadata = { title: common.pageTitles.play };

export default function PlayPage() {
  return <PlayApp />;
}
