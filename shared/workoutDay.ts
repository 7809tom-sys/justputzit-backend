export const WORKOUT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WorkoutDay = (typeof WORKOUT_DAYS)[number];

export function normalizeWorkoutDay(value: string | undefined): WorkoutDay | undefined {
  return WORKOUT_DAYS.includes(value as WorkoutDay) ? value as WorkoutDay : undefined;
}
