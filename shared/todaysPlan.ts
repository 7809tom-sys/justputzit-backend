export type TodayPlanSelection = {
  eventId?: number | null;
  activityId?: number | null;
  note?: string | null;
};

export function buildTodayPlanSelection(item: { id: number; kind: "event" | "activity"; title: string }): TodayPlanSelection {
  return {
    eventId: item.kind === "event" ? item.id : null,
    activityId: item.kind === "activity" ? item.id : null,
    note: item.title,
  };
}
