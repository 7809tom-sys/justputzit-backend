CREATE TABLE `game_room_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_room_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostUserId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`gameType` enum('would_you_rather','trivia','icebreaker','two_truths') NOT NULL DEFAULT 'would_you_rather',
	`city` varchar(120),
	`maxPlayers` int NOT NULL DEFAULT 6,
	`status` enum('waiting','in_progress','finished') NOT NULL DEFAULT 'waiting',
	`currentQuestionIndex` int NOT NULL DEFAULT 0,
	`questions` json,
	`answers` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_rooms_id` PRIMARY KEY(`id`)
);
