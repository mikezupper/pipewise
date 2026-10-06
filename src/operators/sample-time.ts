import { interval } from "../sources/interval.js";
import type { Operator } from "../types.js";
import { sample } from "./sample.js";

/**
 * Every `ms` milliseconds, emits the most recent value if a new one arrived
 * since the last sample.
 *
 * @example
 * mouseMoves.pipeThrough(sampleTime(50));
 */
export function sampleTime<T>(ms: number): Operator<T> {
  return sample<T>(interval(ms));
}
