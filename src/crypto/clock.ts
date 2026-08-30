/** Single clock seam for alert and summary decisions. */
let source: () => Date = () => new Date();

export const now = (): Date => source();

/** Test hook. Production code should use `now()` rather than constructing a Date. */
export function setClockForTests(next?: () => Date): void {
  source = next ?? (() => new Date());
}
