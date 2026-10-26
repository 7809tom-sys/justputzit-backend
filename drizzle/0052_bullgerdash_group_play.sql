ALTER TABLE `game_rooms` MODIFY COLUMN `gameType` enum('would_you_rather','trivia','icebreaker','two_truths','finish_sentence','bullgerdash') NOT NULL DEFAULT 'would_you_rather';

CREATE TABLE `bullgerdash_group_games` (
  `id` int AUTO_INCREMENT NOT NULL,
  `room_id` int NOT NULL,
  `host_user_id` int NOT NULL,
  `player_ids` json NOT NULL,
  `scores` json NOT NULL,
  `current_round` int NOT NULL DEFAULT 1,
  `status` enum('waiting','active','finished') NOT NULL DEFAULT 'waiting',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `bullgerdash_group_games_id` PRIMARY KEY(`id`),
  CONSTRAINT `bullgerdash_group_games_room_id_unique` UNIQUE(`room_id`)
);

CREATE TABLE `bullgerdash_group_rounds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `group_game_id` int NOT NULL,
  `round_number` int NOT NULL,
  `storyteller_id` int NOT NULL,
  `participant_ids` json NOT NULL,
  `photo_id` int NOT NULL,
  `caption` text,
  `is_lie` boolean,
  `phase` enum('storyteller_writing','group_voting','reveal') NOT NULL DEFAULT 'storyteller_writing',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `bullgerdash_group_rounds_id` PRIMARY KEY(`id`),
  CONSTRAINT `bullgerdash_group_round_unique` UNIQUE(`group_game_id`,`round_number`)
);

CREATE TABLE `bullgerdash_group_votes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `round_id` int NOT NULL,
  `voter_id` int NOT NULL,
  `guess` enum('truth','lie') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `bullgerdash_group_votes_id` PRIMARY KEY(`id`),
  CONSTRAINT `bullgerdash_group_vote_unique` UNIQUE(`round_id`,`voter_id`)
);
