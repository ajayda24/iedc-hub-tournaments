/**
 * What every college profile (colleges/<id>/college.ts) fills in.
 * Run `pnpm new-college` to create one by answering a few questions.
 */
export interface College {
  /** folder name under colleges/, lowercase, no spaces (e.g. "iedc", "mec") */
  id: string;
  /** Shown in the browser tab, the install prompt and page headers */
  appName: string;
  /** Short name under the app icon on phones */
  shortName: string;
  /** The landing-page logo is written as `brand.left` + "/" + `brand.right` */
  brand: { left: string; right: string };
  /** Small sticker next to the logo, e.g. "by IEDC" */
  organiser: string;
  /** Browser tab title suffix, e.g. "Play · Weekly Series" (%s is the page name) */
  titleTemplate: string;
  /** Browser tab title for the home page */
  defaultTitle: string;
  /** Search engines and link previews */
  description: string;
  /** Description shown in the "install app" sheet */
  manifestDescription: string;
  /** Event name used until the host renames it in Event settings */
  defaultEventName: string;
  /** Choices on the join form. Also used to group "Dept wars". */
  departments: string[];
  /** Semester / year choices on the join form */
  semesters: string[];
}
