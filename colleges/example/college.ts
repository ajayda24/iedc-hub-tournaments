import type { College } from "../../config/college-types";

/**
 * The neutral starter profile. Run `pnpm setup` to make your own college's
 * profile instead of editing this one.
 */
export const college: College = {
  id: "example",
  appName: "Brain Arena",
  shortName: "Brain Arena",
  brand: { left: "Brain", right: "Arena" },
  organiser: "by Example College",
  titleTemplate: "%s · Brain Arena",
  defaultTitle: "Brain Arena · Example College",
  description: "Live logic-game tournaments for college events. Works fully offline on the event Wi-Fi.",
  manifestDescription: "Live logic-game tournaments for college events.",
  defaultEventName: "Brain Arena",
  departments: ["CSE", "ECE", "EEE", "ME", "CE", "IT"],
  semesters: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
};
