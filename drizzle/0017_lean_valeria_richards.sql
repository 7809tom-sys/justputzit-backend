CREATE TABLE `campus_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campusId` int NOT NULL,
	`verifiedEmail` varchar(200),
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campus_members_id` PRIMARY KEY(`id`)
);
