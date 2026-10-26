CREATE TABLE `wyr_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengerId` int NOT NULL,
	`challengedId` int NOT NULL,
	`matchId` int,
	`questionIds` json NOT NULL,
	`status` enum('pending','active','completed') NOT NULL DEFAULT 'pending',
	`compatibilityPct` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `wyr_challenges_id` PRIMARY KEY(`id`)
);
