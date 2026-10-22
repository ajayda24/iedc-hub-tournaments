import type { Metadata } from "next";
import { common } from "@iedc/config/copy/common";
import { ScreenApp } from "@/screens/ScreenApp";

export const metadata: Metadata = { title: common.pageTitles.screen };

export default function ScreenPage() {
  return <ScreenApp />;
}
