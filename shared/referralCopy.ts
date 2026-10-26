export const JUST_PUTZIT_REFERRAL_INTRO =
  "Hey! I'm using Just Putzit to discover local events, activities, and real-world connection.";
export const JUST_PUTZIT_REFERRAL_NOTE = `${JUST_PUTZIT_REFERRAL_INTRO} Join me!`;

export function buildJustPutzitReferralMessage(inviteLink: string, note = JUST_PUTZIT_REFERRAL_NOTE) {
  const safeNote = note.trim().slice(0, 500) || JUST_PUTZIT_REFERRAL_NOTE;
  return `${safeNote}\n\n${inviteLink}`;
}
