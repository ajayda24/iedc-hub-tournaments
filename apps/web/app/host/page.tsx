import type { Metadata } from "next";
import { common } from "@iedc/data/copy/common";
import { HostApp } from "@/screens/HostApp";

export const metadata: Metadata = { title: common.pageTitles.host };

export default function HostPage() {
  return <HostApp />;
}
