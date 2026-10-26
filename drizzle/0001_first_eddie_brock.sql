CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`senderId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`gameType` enum('newlywed','two_truths','this_or_that') NOT NULL DEFAULT 'newlywed',
	`questions` json NOT NULL DEFAULT ('[]'),
	`status` enum('waiting','in_progress','completed') NOT NULL DEFAULT 'waiting',
	`user1Score` int NOT NULL DEFAULT 0,
	`user2Score` int NOT NULL DEFAULT 0,
	`sallyNarration` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`messages` json NOT NULL DEFAULT ('[]'),
	`extractedTraits` json NOT NULL DEFAULT ('{}'),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interview_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user1Id` int NOT NULL,
	`user2Id` int NOT NULL,
	`compatibilityScore` int NOT NULL DEFAULT 0,
	`compatibilityReason` text,
	`status` enum('pending','active','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('new_match','game_ready','new_message','interview_reminder') NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`relatedId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`avatarEmoji` varchar(10) NOT NULL DEFAULT '😊',
	`avatarColor` varchar(20) NOT NULL DEFAULT '#f97316',
	`displayName` varchar(100),
	`bio` text,
	`networkType` enum('singles','couples','community') NOT NULL DEFAULT 'singles',
	`traits` json NOT NULL DEFAULT ('{}'),
	`interviewCount` int NOT NULL DEFAULT 0,
	`isVerified` boolean NOT NULL DEFAULT false,
	`onboardingComplete` boolean NOT NULL DEFAULT false,
	`latitude` varchar(20),
	`longitude` varchar(20),
	`city` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
