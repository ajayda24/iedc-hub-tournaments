"use client";
import { useEffect, useState } from "react";
import type { CollegeInfo } from "@iedc/shared/protocol";
import { site } from "@iedc/config/site";
import { DEPARTMENTS, SEMESTERS } from "@iedc/config/people";
import { arenaUrl, isArenaOrigin } from "./arena";

const builtIn: CollegeInfo = { brand: site.brand, organiser: site.organiser, departments: DEPARTMENTS, semesters: SEMESTERS };
let cached: CollegeInfo | null = null;
let loading: Promise<CollegeInfo> | null = null;

/** Forget the cached copy (after the host saves the College tab). */
export function refreshCollege(next?: CollegeInfo) {
  cached = next ?? null;
  loading = null;
}

/**
 * College name and join-form lists. On the event laptop these can be changed
 * by the host (Host console → College); everywhere else they're the built-in
 * profile from colleges/<id>/college.ts.
 */
export function useCollege(): CollegeInfo {
  const [info, setInfo] = useState<CollegeInfo>(cached ?? builtIn);
  useEffect(() => {
    if (!isArenaOrigin()) return;
    if (cached) return setInfo(cached);
    loading ??= fetch(`${arenaUrl()}/api/college`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : builtIn))
      .then((c: CollegeInfo) => (cached = c))
      .catch(() => builtIn);
    let alive = true;
    void loading.then((c) => alive && setInfo(c));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}
