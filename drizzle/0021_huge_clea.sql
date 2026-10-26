CREATE TABLE `game_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`roomType` enum('trivia','match_game') NOT NULL DEFAULT 'trivia',
	`userId` int NOT NULL,
	`content` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`tripDate` varchar(10) NOT NULL,
	`city` varchar(128),
	`notes` text,
	`items` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trip_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` enum('A','B','C','D') NOT NULL,
	`isCorrect` boolean NOT NULL DEFAULT false,
	`answeredAtMs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`optionA` varchar(300) NOT NULL,
	`optionB` varchar(300) NOT NULL,
	`optionC` varchar(300) NOT NULL,
	`optionD` varchar(300) NOT NULL,
	`correctAnswer` enum('A','B','C','D') NOT NULL,
	`category` enum('relationships','pop_culture','local_knowledge','food_drinks','sports_outdoors','wild_card') NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`profileTraitKey` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_room_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`streak` int NOT NULL DEFAULT 0,
	`isReady` boolean NOT NULL DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_room_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameCode` varchar(8) NOT NULL,
	`hostUserId` int NOT NULL,
	`status` enum('waiting','in_progress','completed') NOT NULL DEFAULT 'waiting',
	`maxPlayers` int NOT NULL DEFAULT 8,
	`currentQuestionIndex` int NOT NULL DEFAULT 0,
	`questionIds` json DEFAULT ('[]'),
	`questionTimerSeconds` int NOT NULL DEFAULT 15,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `trivia_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `trivia_rooms_gameCode_unique` UNIQUE(`gameCode`)
);
