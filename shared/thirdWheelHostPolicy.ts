export const THIRD_WHEEL_HOST_GUIDANCE =
  "A listed event host is scheduled to be on site and can help with event logistics. This is not emergency, medical, or law-enforcement support.";

export function canDisplayThirdWheelHost(value: unknown): boolean {
  return value === true;
}
