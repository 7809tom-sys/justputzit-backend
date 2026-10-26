export function isValidMemberSafetyTarget(actorUserId: number, targetUserId: number) {
  return Number.isInteger(actorUserId) && Number.isInteger(targetUserId) && actorUserId > 0 && targetUserId > 0 && actorUserId !== targetUserId;
}

export const BLOCKED_CONVERSATION_MESSAGE = "This conversation is closed";
