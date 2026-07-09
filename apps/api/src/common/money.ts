/** Round to 2 decimal places (currency). Foundation-grade; revisit if we move to integer cents. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sum an array of numbers and round to cents. */
export function sum2(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}
