CREATE TABLE `game_chat_messages_v2` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`roomType` enum('trivia','jeopardy','trivia_pursuit','match_game') NOT NULL DEFAULT 'trivia',
	`userId` int NOT NULL,
	`content` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_chat_messages_v2_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jeopardy_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` varchar(300) NOT NULL,
	`isCorrect` boolean NOT NULL DEFAULT false,
	`pointsAwarded` int NOT NULL DEFAULT 0,
	`answeredAtMs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jeopardy_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jeopardy_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`emoji` varchar(10),
	`color` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jeopardy_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jeopardy_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`clue` text NOT NULL,
	`answer` varchar(300) NOT NULL,
	`value` int NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jeopardy_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jeopardy_room_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`isReady` boolean NOT NULL DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jeopardy_room_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jeopardy_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameCode` varchar(8) NOT NULL,
	`hostUserId` int NOT NULL,
	`status` enum('waiting','in_progress','completed') NOT NULL DEFAULT 'waiting',
	`maxPlayers` int NOT NULL DEFAULT 10,
	`categoryIds` json NOT NULL,
	`currentClueIndex` int NOT NULL DEFAULT 0,
	`clueOrder` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `jeopardy_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `jeopardy_rooms_gameCode_unique` UNIQUE(`gameCode`)
);
--> statement-breakpoint
CREATE TABLE `trivia_pursuit_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` enum('A','B','C','D') NOT NULL,
	`isCorrect` boolean NOT NULL DEFAULT false,
	`answeredAtMs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_pursuit_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_pursuit_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`emoji` varchar(10),
	`color` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_pursuit_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_pursuit_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`question` text NOT NULL,
	`optionA` varchar(300) NOT NULL,
	`optionB` varchar(300) NOT NULL,
	`optionC` varchar(300) NOT NULL,
	`optionD` varchar(300) NOT NULL,
	`correctAnswer` enum('A','B','C','D') NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_pursuit_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_pursuit_room_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`isReady` boolean NOT NULL DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trivia_pursuit_room_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_pursuit_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameCode` varchar(8) NOT NULL,
	`hostUserId` int NOT NULL,
	`status` enum('waiting','in_progress','completed') NOT NULL DEFAULT 'waiting',
	`maxPlayers` int NOT NULL DEFAULT 10,
	`categoryIds` json NOT NULL,
	`currentQuestionIndex` int NOT NULL DEFAULT 0,
	`questionIds` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `trivia_pursuit_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `trivia_pursuit_rooms_gameCode_unique` UNIQUE(`gameCode`)
);
