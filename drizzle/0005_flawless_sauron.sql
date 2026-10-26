CREATE TABLE `would_you_rather_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`choice` enum('A','B') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `would_you_rather_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `would_you_rather_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`optionA` varchar(300) NOT NULL,
	`optionB` varchar(300) NOT NULL,
	`category` enum('food','travel','lifestyle','romance','fun','deep','campus') NOT NULL DEFAULT 'fun',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `would_you_rather_questions_id` PRIMARY KEY(`id`)
);
