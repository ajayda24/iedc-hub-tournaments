import { site } from "@iedc/data/site";
import { cx } from "@/lib/format";

/** "developed by" name tag at the bottom of the browsing pages. */
export function Credits({ className }: { className?: string }) {
  const c = site.credits;
  return (
    <footer className={cx("mt-6 flex justify-center border-t-2 border-dashed border-ink/25 pt-6", className)}>
      <a
        href={c.url}
        target="_blank"
        rel="noopener"
        className="slip flex -rotate-1 items-center gap-3 !rounded-full py-1.5 pl-1.5 pr-4 !shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 hover:rotate-0"
      >
        <img src="/credits/developer.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full border-2 border-ink bg-yellow object-cover" />
        <span className="flex flex-col leading-tight">
          <span className="hand text-sm text-pencil">{c.label}</span>
          <span className="font-black">
            <span className="hl">{c.name}</span> <span aria-hidden>↗</span>
          </span>
        </span>
      </a>
    </footer>
  );
}
