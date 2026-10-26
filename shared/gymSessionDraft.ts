export type GymSessionDraft = {
  title: string;
  date: string;
  time: string;
  maxParticipants: string;
};

export type ParsedGymSessionDraft =
  | { ok: true; scheduledAt: number; maxParticipants: number }
  | { ok: false; message: string };

export function parseGymSessionDraft(draft: GymSessionDraft, now = Date.now()): ParsedGymSessionDraft {
  if (!draft.title.trim() || !draft.date || !draft.time) {
    return { ok: false, message: "Please fill in the session title, date, and time." };
  }

  const maxParticipants = Number(draft.maxParticipants);
  if (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 20) {
    return { ok: false, message: "Choose a group size from 2 to 20 people." };
  }

  const scheduledAt = new Date(`${draft.date}T${draft.time}`).getTime();
  if (!Number.isFinite(scheduledAt) || scheduledAt <= now) {
    return { ok: false, message: "Choose a future date and time for this workout." };
  }

  return { ok: true, scheduledAt, maxParticipants };
}
