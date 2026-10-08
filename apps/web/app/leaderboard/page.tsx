import type { Metadata } from "next";
import { common } from "@iedc/data/copy/common";
import { LeaderboardApp } from "@/screens/LeaderboardApp";

export const metadata: Metadata = { title: common.pageTitles.leaderboard };

export default function LeaderboardPage() {
  return <LeaderboardApp />;
}
