import { usageError } from "./usage.js";

export const DATE_RANGES = ["THIS_WEEK", "LAST_WEEK", "THIS_MONTH", "LAST_MONTH", "THIS_YEAR", "LAST_YEAR", "CUSTOM"];
export const GROUPINGS = ["PROJECT", "CLIENT", "TAG", "DATE", "USER"];

export function assertOneOf(value: string, allowed: string[], flag: string): void {
  if (!allowed.includes(value)) {
    throw usageError(`Unknown ${flag} value "${value}"`, [`Valid values: ${allowed.join(", ")}`]);
  }
}
