export const maxWeightText = "999.9";
export const maxRepsText = "999";

const repsInputPattern = /^[1-9]\d{0,2}$/;
const weightInputPattern = /^[1-9]\d{0,2}(?:\.\d?)?$/;
const weightValuePattern = /^[1-9]\d{0,2}(?:\.\d)?$/;

export function shouldAcceptRepsInput(value: string): boolean {
  return value === "" || repsInputPattern.test(value);
}

export function shouldAcceptWeightInput(value: string): boolean {
  return value === "" || weightInputPattern.test(value);
}

export function isValidRepsValue(value: string): boolean {
  return repsInputPattern.test(value.trim());
}

export function isValidWeightValue(value: string): boolean {
  return weightValuePattern.test(value.trim());
}

export function parseRepsValue(value: string): number {
  return isValidRepsValue(value) ? Number.parseInt(value, 10) : 0;
}
