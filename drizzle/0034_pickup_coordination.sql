CREATE TABLE `pickup_alert_preferences` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `city` varchar(100),
  `categories` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pickup_alert_preferences_id` PRIMARY KEY (`id`),
  CONSTRAINT `pickup_alert_preferences_user_id_unique` UNIQUE (`user_id`)
);

CREATE TABLE `pickup_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `host_user_id` int NOT NULL,
  `activity_type` varchar(40) NOT NULL,
  `title` varchar(160) NOT NULL,
  `description` text,
  `city` varchar(100) NOT NULL,
  `state` varchar(32) NOT NULL,
  `venue_name` varchar(200) NOT NULL,
  `venue_address` varchar(300),
  `start_at` timestamp NOT NULL,
  `end_at` timestamp,
  `capacity` int NOT NULL DEFAULT 10,
  `status` enum('open','full','cancelled','completed') NOT NULL DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pickup_sessions_id` PRIMARY KEY (`id`)
);

CREATE TABLE `pickup_participants` (
  `id` int AUTO_INCREMENT NOT NULL,
  `session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('joined','maybe','declined') NOT NULL DEFAULT 'joined',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `pickup_participants_id` PRIMARY KEY (`id`)
);

ALTER TABLE `notifications` MODIFY COLUMN `type` enum('new_match','game_ready','new_message','interview_reminder','pickup_invite') NOT NULL;
