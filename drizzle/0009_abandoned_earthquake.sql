CREATE TABLE `login_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendorId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`videoUrl` text NOT NULL,
	`ctaText` varchar(128),
	`ctaUrl` text,
	`durationSeconds` int NOT NULL DEFAULT 10,
	`budgetCents` int NOT NULL DEFAULT 0,
	`spentCents` int NOT NULL DEFAULT 0,
	`cpmCents` int NOT NULL DEFAULT 5,
	`impressions` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passkey_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credentialId` varchar(512) NOT NULL,
	`publicKey` text NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	`deviceType` varchar(64),
	`transports` text,
	`aaguid` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `passkey_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkey_credentials_credentialId_unique` UNIQUE(`credentialId`)
);
