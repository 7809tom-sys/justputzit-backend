CREATE TABLE `campuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`shortName` varchar(60),
	`city` varchar(100) NOT NULL,
	`state` varchar(60) NOT NULL,
	`emailDomains` varchar(400) NOT NULL DEFAULT '',
	`launchThreshold` int NOT NULL DEFAULT 100,
	`isLive` boolean NOT NULL DEFAULT false,
	`mascot` varchar(60),
	`colorHex` varchar(20) NOT NULL DEFAULT '#f97316',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviterUserId` int NOT NULL,
	`inviteeUserId` int NOT NULL,
	`inviteCode` varchar(40) NOT NULL,
	`campusId` int,
	`status` enum('joined','verified') NOT NULL DEFAULT 'joined',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `campusId` int;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `schoolEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `inviteCode` varchar(40);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `isAmbassador` boolean DEFAULT false NOT NULL;