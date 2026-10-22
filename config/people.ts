/**
 * Choices students pick on the join form. Also used to group "Dept wars".
 * The lists live in the college profile: colleges/<id>/college.ts.
 * Add "Other" to a college's departments to let students type their own.
 */
import { college } from "./college";

export const DEPARTMENTS: string[] = college.departments;

/** The "Other" option, which shows a free-text box when it's in the list */
export const OTHER_DEPARTMENT = "Other";

export const SEMESTERS: string[] = college.semesters;
