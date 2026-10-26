CREATE TABLE IF NOT EXISTS `pick_plan_rounds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `matchId` int NOT NULL,
  `creatorId` int NOT NULL,
  `candidateEventIds` json NOT NULL,
  `status` enum('voting','matched','expired','cancelled') NOT NULL DEFAULT 'voting',
  `matchedEventId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  CONSTRAINT `pick_plan_rounds_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `pick_plan_votes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `roundId` int NOT NULL,
  `userId` int NOT NULL,
  `eventId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pick_plan_votes_id` PRIMARY KEY(`id`),
  CONSTRAINT `pick_plan_round_member_unique` UNIQUE(`roundId`, `userId`)
);
