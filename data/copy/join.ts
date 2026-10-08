/**
 * Join form students fill in on their phones (/play, first visit).
 */
export const join = {
  welcome: "welcome to",
  nameLabel: "Full name",
  namePlaceholder: "e.g. Anjali Nair",
  semesterLabel: "Semester",
  departmentLabel: "Department",
  otherDeptPlaceholder: "Your department",
  avatarTitle: "Your face tonight",
  avatarHint: "tap shuffle until it feels right",
  shuffle: "Shuffle",
  joinButton: "Jump in →",
  joiningButton: "Joining…",
  noSignupNote: "No sign-up. Your score sticks to this phone, so don't switch devices.",

  // validation
  needName: "Your full name, please.",
  needSemester: "Pick your semester.",
  needDepartment: "Pick your department.",
  couldNotJoin: "Couldn't join.",
  noAnswer: "The arena didn't answer. Are you on the event Wi-Fi?",
} as const;
