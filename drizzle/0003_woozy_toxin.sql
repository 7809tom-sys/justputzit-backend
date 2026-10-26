CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`activityId` int NOT NULL,
	`venueId` int NOT NULL,
	`matchId` int,
	`partySize` int NOT NULL DEFAULT 2,
	`unitPriceCents` int NOT NULL DEFAULT 0,
	`totalPriceCents` int NOT NULL DEFAULT 0,
	`commissionCents` int NOT NULL DEFAULT 0,
	`referralFeeCents` int NOT NULL DEFAULT 0,
	`bookingType` enum('ticket','reservation','rsvp_free') NOT NULL DEFAULT 'ticket',
	`status` enum('confirmed','cancelled','completed','checked_in') NOT NULL DEFAULT 'confirmed',
	`confirmationCode` varchar(20) NOT NULL,
	`scheduledFor` timestamp,
	`notes` text,
	`checkedInAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `concierge_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`matchId` int,
	`occasion` varchar(120) NOT NULL DEFAULT 'date',
	`vibe` varchar(200),
	`location` varchar(200),
	`budgetCents` int NOT NULL DEFAULT 5000,
	`partySize` int NOT NULL DEFAULT 2,
	`preferredDate` timestamp,
	`dietaryNotes` text,
	`sallyPlanTitle` varchar(200),
	`sallyPlanSummary` text,
	`sallyPlanItems` json,
	`estTotalCents` int NOT NULL DEFAULT 0,
	`status` enum('draft','proposed','confirmed','arranged','completed','cancelled') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concierge_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `couple_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`partnerName` varchar(100) NOT NULL,
	`partnerEmail` varchar(320),
	`relationshipLength` varchar(60),
	`sharedInterests` json,
	`lookingFor` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `couple_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `couple_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`couple1UserId` int NOT NULL,
	`couple2UserId` int NOT NULL,
	`compatibilityScore` int NOT NULL DEFAULT 0,
	`compatibilityReason` text,
	`status` enum('active','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `couple_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `activity_listings` ADD `priceCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_listings` ADD `hasTickets` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_listings` ADD `imageEmoji` varchar(10) DEFAULT '🎉' NOT NULL;--> statement-breakpoint
ALTER TABLE `venue_partners` ADD `commissionPct` int DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `venue_partners` ADD `ownerUserId` int;--> statement-breakpoint
ALTER TABLE `venue_partners` ADD `contactEmail` varchar(320);