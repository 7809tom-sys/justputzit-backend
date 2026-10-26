CREATE TABLE `entertainment_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`category` enum('concert','theme_park','adventure','sports','comedy','other') NOT NULL DEFAULT 'other',
	`eventId` varchar(128) NOT NULL,
	`eventTitle` varchar(255) NOT NULL,
	`venueName` varchar(255),
	`venueCity` varchar(128),
	`affiliateNetwork` varchar(64) NOT NULL,
	`affiliateUrl` text NOT NULL,
	`estimatedCommissionCents` int NOT NULL DEFAULT 0,
	`estimatedCommissionPct` int NOT NULL DEFAULT 0,
	`clickedAt` timestamp NOT NULL DEFAULT (now()),
	`userCity` varchar(128),
	CONSTRAINT `entertainment_clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friend_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviterId` int NOT NULL,
	`contactName` varchar(128) NOT NULL,
	`contactPhone` varchar(32),
	`contactEmail` varchar(320),
	`inviteCode` varchar(32) NOT NULL,
	`status` enum('sent','opened','joined') NOT NULL DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`openedAt` timestamp,
	`joinedAt` timestamp,
	`joinedUserId` int,
	CONSTRAINT `friend_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `friend_invites_inviteCode_unique` UNIQUE(`inviteCode`)
);
