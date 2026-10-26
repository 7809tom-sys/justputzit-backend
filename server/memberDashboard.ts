export type DashboardAchievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressLabel: string;
};

type Traits = Record<string, unknown> | null | undefined;

function completedTraitCount(traits: Traits, keys: readonly string[]) {
  return keys.filter((key) => Boolean(traits?.[key])).length;
}

export function deriveGameAchievements(
  traits: Traits,
  wyrAnswerCount: number,
  completedChallengeCount: number,
): DashboardAchievement[] {
  const socialGames = [
    {
      id: "local_legend",
      emoji: "📍",
      title: "Local Legend",
      description: "Shared the places that make your neighborhood feel like home.",
      keys: ["local_afternoon_style", "local_recommendation_style", "community_connection_style"],
    },
    {
      id: "perfect_saturday",
      emoji: "☀️",
      title: "Weekend Planner",
      description: "Built a community-minded version of your perfect Saturday.",
      keys: ["saturday_morning_style", "saturday_afternoon_style", "saturday_evening_style", "repeat_plan_value"],
    },
    {
      id: "three_in_common",
      emoji: "🫶",
      title: "Common Ground",
      description: "Saved conversation starters for easy local connections.",
      keys: ["common_ground_starters"],
    },
    {
      id: "would_you_join_me",
      emoji: "🤝",
      title: "Public Plan Ready",
      description: "Chose a comfortable, public way to meet someone new.",
      keys: ["public_plan_interest"],
    },
  ].map((achievement) => {
    const progress = completedTraitCount(traits, achievement.keys);
    const target = achievement.keys.length;
    return {
      id: achievement.id,
      emoji: achievement.emoji,
      title: achievement.title,
      description: achievement.description,
      unlocked: progress === target,
      progressLabel: progress === target ? "Unlocked" : `${progress} of ${target} picks`,
    };
  });

  return [
    ...socialGames,
    {
      id: "would_you_rather",
      emoji: "⚖️",
      title: "This or That",
      description: "Explored the community’s favorite choices in Would You Rather.",
      unlocked: wyrAnswerCount >= 5,
      progressLabel: wyrAnswerCount >= 5 ? "Unlocked" : `${Math.min(wyrAnswerCount, 5)} of 5 answers`,
    },
    {
      id: "wyr_challenge",
      emoji: "⚔️",
      title: "Friendly Challenger",
      description: "Completed a shared Would You Rather challenge with a match.",
      unlocked: completedChallengeCount > 0,
      progressLabel: completedChallengeCount > 0 ? "Unlocked" : "Play with a match",
    },
  ];
}
