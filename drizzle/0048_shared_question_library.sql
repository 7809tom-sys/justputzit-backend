CREATE TABLE IF NOT EXISTS `shared_question_library` (
  `id` int AUTO_INCREMENT NOT NULL,
  `prompt` text NOT NULL,
  `format` enum('would_you_rather','multiple_choice','free_response','visual') NOT NULL,
  `category` varchar(100) NOT NULL,
  `difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
  `optionA` varchar(300),
  `optionB` varchar(300),
  `optionC` varchar(300),
  `optionD` varchar(300),
  `canonicalAnswer` varchar(500),
  `acceptedAnswers` json NOT NULL,
  `imageUrl` varchar(1000),
  `sourceUrl` varchar(1000),
  `license` varchar(255),
  `attribution` text,
  `contentStatus` enum('draft','approved','published','retired') NOT NULL DEFAULT 'draft',
  `revision` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `publishedAt` timestamp,
  CONSTRAINT `shared_question_library_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `shared_question_game_targets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `questionId` int NOT NULL,
  `gameType` enum('would_you_rather','trivia','jeopardy','trivia_pursuit','bullgerdash','pick_a_plan') NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `gameConfig` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `shared_question_game_targets_id` PRIMARY KEY(`id`),
  CONSTRAINT `shared_question_game_target_unique` UNIQUE(`questionId`, `gameType`)
);
