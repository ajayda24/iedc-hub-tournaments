import type { Metadata } from "next";
import { HostApp } from "@/screens/HostApp";

export const metadata: Metadata = { title: "Host console" };

export default function HostPage() {
  return <HostApp />;
}
