CREATE TABLE `activity_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`venueId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`category` enum('bowling','mini_golf','kayaking','movies','dining','coffee','cooking_class','escape_room','wine_tasting','hiking','park','library','church','community_center','sports','arts','other') NOT NULL DEFAULT 'other',
	`eventDate` timestamp,
	`durationMinutes` int DEFAULT 120,
	`maxGroupSize` int DEFAULT 10,
	`minGroupSize` int DEFAULT 2,
	`isRecurring` boolean NOT NULL DEFAULT false,
	`recurringSchedule` varchar(100),
	`checkInCode` varchar(20),
	`totalReferrals` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_rsvps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activityId` int NOT NULL,
	`userId` int NOT NULL,
	`matchId` int,
	`status` enum('going','maybe','not_going') NOT NULL DEFAULT 'going',
	`checkedIn` boolean NOT NULL DEFAULT false,
	`checkedInAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_rsvps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`flagType` enum('bot_behavior','multiple_reports','suspicious_location','identity_mismatch','manual_review') NOT NULL,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`notes` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerId` int NOT NULL,
	`blockedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('member','organizer') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_group_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`category` enum('book_club','hiking','cooking','sports','arts','music','gaming','travel','fitness','social','other') NOT NULL DEFAULT 'other',
	`city` varchar(100),
	`createdByUserId` int NOT NULL,
	`maxMembers` int DEFAULT 20,
	`isPublic` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`reportedUserId` int NOT NULL,
	`reason` enum('scammer','bot','harassment','fake_profile','inappropriate','other') NOT NULL,
	`details` text,
	`status` enum('pending','reviewed','actioned','dismissed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venue_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` enum('bowling','mini_golf','kayaking','movies','dining','coffee','cooking_class','escape_room','wine_tasting','hiking','park','library','church','community_center','sports','arts','other') NOT NULL DEFAULT 'other',
	`description` text,
	`address` text,
	`city` varchar(100),
	`latitude` varchar(20),
	`longitude` varchar(20),
	`phone` varchar(30),
	`website` varchar(300),
	`referralFeePerVisit` int NOT NULL DEFAULT 100,
	`isActive` boolean NOT NULL DEFAULT true,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `venue_partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `game_sessions` MODIFY COLUMN `questions` json NOT NULL;--> statement-breakpoint
ALTER TABLE `interview_sessions` MODIFY COLUMN `messages` json NOT NULL;--> statement-breakpoint
ALTER TABLE `interview_sessions` MODIFY COLUMN `extractedTraits` json NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `title` varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` MODIFY COLUMN `traits` json NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `isRead` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `expiresAt` timestamp;