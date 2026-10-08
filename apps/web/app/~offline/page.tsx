import Link from "next/link";
import { Mascot } from "@/ui/Mascot";
import { common } from "@iedc/data/copy/common";

export const metadata = { title: common.pageTitles.offline };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Mascot mood="sleep" size={110} />
      <h1 className="text-3xl font-black">{common.offlineTitle}</h1>
      <p className="font-semibold text-ink-soft">{common.offlineBody}</p>
      <Link href="/practice/" className="sticker !bg-mint">
        {common.offlineButton}
      </Link>
    </main>
  );
}
