CREATE TABLE `profile_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`exifLat` varchar(20),
	`exifLng` varchar(20),
	`exifCity` varchar(100),
	`cityVerified` boolean NOT NULL DEFAULT false,
	`verificationNote` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profile_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `gender` enum('man','woman','non_binary','other','prefer_not_to_say');--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `sexualOrientation` enum('straight','gay','lesbian','bisexual','pansexual','asexual','queer','other','prefer_not_to_say');--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `birthdate` timestamp;