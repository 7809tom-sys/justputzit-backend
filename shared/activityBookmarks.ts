export function isActivityBookmarked(bookmarkIds: number[] | undefined, activityId: number) {
  return bookmarkIds?.includes(activityId) ?? false;
}

export function getActivityBookmarkFeedback(isBookmarked: boolean) {
  return isBookmarked
    ? { title: "Event saved", description: "You can find it again in your saved events." }
    : { title: "Event removed", description: "It is no longer in your saved events." };
}
