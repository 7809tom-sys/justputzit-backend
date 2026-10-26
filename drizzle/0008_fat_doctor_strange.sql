CREATE TABLE `community_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` enum('music','food','market','sports','arts','community','outdoors','other') NOT NULL DEFAULT 'other',
	`eventDate` timestamp NOT NULL,
	`endDate` timestamp,
	`venueName` varchar(255),
	`address` text,
	`city` varchar(100) NOT NULL DEFAULT 'Milwaukee',
	`state` varchar(50) NOT NULL DEFAULT 'WI',
	`isFree` boolean NOT NULL DEFAULT true,
	`priceCents` int NOT NULL DEFAULT 0,
	`externalUrl` text,
	`imageUrl` text,
	`source` enum('community','eventbrite','admin') NOT NULL DEFAULT 'admin',
	`externalId` varchar(128),
	`postedByUserId` int,
	`rsvpCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_rsvps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_rsvps_id` PRIMARY KEY(`id`)
);
