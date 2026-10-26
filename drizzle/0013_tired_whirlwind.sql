CREATE TABLE `venue_outreach` (
	`id` int AUTO_INCREMENT NOT NULL,
	`venueId` int NOT NULL,
	`sentByUserId` int NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`status` enum('sent','failed','draft') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `venue_outreach_id` PRIMARY KEY(`id`)
);
