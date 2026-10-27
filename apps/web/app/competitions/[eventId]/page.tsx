import type { Metadata } from "next";
import { COMPETITIONS, COMPETITION_IDS } from "@iedc/shared/competitions/registry";
import { CompetitionPage } from "@/competitions";

type Props = { params: Promise<{ eventId: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => COMPETITION_IDS.map((eventId) => ({ eventId }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  return { title: COMPETITIONS[eventId]?.title };
}

export default async function Page({ params }: Props) {
  const { eventId } = await params;
  return <CompetitionPage eventId={eventId} view="player" />;
}
