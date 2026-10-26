CREATE TABLE `family_children` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyProfileId` int NOT NULL,
	`ageYears` int NOT NULL,
	`gender` enum('boy','girl','nonbinary','prefer_not_to_say'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_children_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`family1Id` int NOT NULL,
	`family2Id` int NOT NULL,
	`compatibilityScore` int NOT NULL DEFAULT 0,
	`status` enum('pending','connected','declined') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`familyName` varchar(128) NOT NULL,
	`bio` text,
	`neighborhoodCity` varchar(128),
	`interests` json DEFAULT ('[]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_profiles_userId_unique` UNIQUE(`userId`)
);
