import type { College } from "../../config/college-types";

/** IEDC — the college this platform was first built for. */
export const college: College = {
  id: "iedc",
  appName: "IEDC Weekly Series",
  shortName: "IEDC Weekly Series",
  brand: { left: "Weekly", right: "Series" },
  organiser: "by IEDC",
  titleTemplate: "%s · Weekly Series",
  defaultTitle: "Weekly Series · IEDC",
  description: "Live logic-game tournaments for IEDC events. Works fully offline on the event Wi-Fi.",
  manifestDescription: "Live logic-game tournaments for IEDC events.",
  defaultEventName: "Weekly Series",
  departments: ["CSE", "EC", "EEE", "ME", "CE", "IT", "EP", "PT"],
  semesters: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
};
