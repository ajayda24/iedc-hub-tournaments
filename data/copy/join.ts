/**
 * Join form students fill in on their phones (/play, first visit).
 */
export const join = {
  welcome: "welcome to",
  nameLabel: "Full name",
  studentIdLabel: "Student ID",
  studentIdHint: "or admission / roll no. if you don't have one yet",
  studentIdPlaceholder: "IEAXEIT001",
  namePlaceholder: "e.g. Anjali Nair",
  semesterLabel: "Semester",
  departmentLabel: "Department",
  otherDeptPlaceholder: "Your department",
  avatarTitle: "Your face tonight",
  avatarHint: "tap shuffle until it feels right",
  shuffle: "Shuffle",
  joinButton: "Jump in →",
  joiningButton: "Joining…",
  noSignupNote: "No sign-up. Your Student ID + PIN keep your score, even if you switch phones.",

  // validation
  needName: "Your full name, please.",
  needStudentId: "Your Student ID, please (admission or roll no. works too).",
  needSemester: "Pick your semester.",
  needDepartment: "Pick your department.",
  couldNotJoin: "Couldn't join.",
  noAnswer: "The arena didn't answer. Are you on the event Wi-Fi?",

  // step 2: PIN
  nextButton: "Next →",
  checking: "Checking…",
  backButton: "← Back",
  createPinTitle: "Create your PIN",
  createPinBody: (id: string) => `This PIN protects ${id}. You'll need it every time you join a tournament on a new phone.`,
  pinLabel: (n: number) => `${n}-digit PIN`,
  confirmPinLabel: "Type it again",
  enterPinTitle: "Welcome back!",
  enterPinBody: (id: string) => `Enter the PIN for ${id}.`,
  saveInfoTitle: "Save your PIN now",
  saveInfoBody: "There's no \"forgot PIN\". When your browser offers to save the password, tap Save — or write it down somewhere safe. Only the host can reset it.",
  pinNeedsDigits: (n: number) => `The PIN must be exactly ${n} digits.`,
  pinMismatch: "The two PINs don't match.",
  createButton: "Create PIN & jump in →",
  enterButton: "Jump in →",
} as const;
