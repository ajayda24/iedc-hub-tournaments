import Link from "next/link";
import { Mascot } from "@/ui/Mascot";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Mascot mood="dizzy" size={110} />
      <h1 className="text-3xl font-black">404. Even Bulbu is lost.</h1>
      <Link href="/" className="sticker">
        Take me home
      </Link>
    </main>
  );
}
