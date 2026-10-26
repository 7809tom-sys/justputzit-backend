export type EventIntroductionCandidate = {
  requesterUserId: number;
  candidateUserId: number;
  requesterOptedIn: boolean;
  candidateOptedIn: boolean;
  isBlocked: boolean;
  alreadyMatched: boolean;
};

/**
 * An event introduction is only available when two different attendees each opted
 * in to Sally introductions, neither person blocked the other, and they do not
 * already have a match. It is deliberately a review-free safety gate: callers
 * should never infer a personality trait or attendee identity from this result.
 */
export function canCreateEventIntroduction(candidate: EventIntroductionCandidate): boolean {
  return candidate.requesterUserId !== candidate.candidateUserId
    && candidate.requesterOptedIn
    && candidate.candidateOptedIn
    && !candidate.isBlocked
    && !candidate.alreadyMatched;
}

export function getEventIntroductionPair(userAId: number, userBId: number) {
  return userAId < userBId
    ? { lowerUserId: userAId, higherUserId: userBId }
    : { lowerUserId: userBId, higherUserId: userAId };
}
