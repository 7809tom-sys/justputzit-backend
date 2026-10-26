CREATE TABLE `bullgerdash_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`image_url` text NOT NULL,
	`truth_caption` text NOT NULL,
	`category` varchar(50) DEFAULT 'obscure',
	`added_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bullgerdash_photos_id` PRIMARY KEY(`id`)
);

CREATE TABLE `bullgerdash_games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int NOT NULL,
	`player1_id` int NOT NULL,
	`player2_id` int NOT NULL,
	`player1_score` int NOT NULL DEFAULT 0,
	`player2_score` int NOT NULL DEFAULT 0,
	`current_round` int NOT NULL DEFAULT 1,
	`status` enum('active','finished') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bullgerdash_games_id` PRIMARY KEY(`id`)
);

CREATE TABLE `bullgerdash_rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`game_id` int NOT NULL,
	`round_number` int NOT NULL,
	`storyteller_id` int NOT NULL,
	`photo_id` int NOT NULL,
	`caption` text,
	`is_lie` boolean,
	`voter_id` int,
	`voter_guess` enum('truth','lie'),
	`storyteller_points` int DEFAULT 0,
	`voter_points` int DEFAULT 0,
	`phase` enum('storyteller_writing','voter_guessing','reveal') NOT NULL DEFAULT 'storyteller_writing',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bullgerdash_rounds_id` PRIMARY KEY(`id`)
);
