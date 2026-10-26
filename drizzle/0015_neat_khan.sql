CREATE TABLE `movie_booking_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`movieId` varchar(32) NOT NULL,
	`movieTitle` varchar(255) NOT NULL,
	`theaterId` varchar(64) NOT NULL DEFAULT 'marcus-majestic-brookfield',
	`theaterName` varchar(255) NOT NULL DEFAULT 'Marcus Majestic Cinema',
	`affiliateNetwork` varchar(64) NOT NULL DEFAULT 'fandango-cj',
	`clickedAt` timestamp NOT NULL DEFAULT (now()),
	`userCity` varchar(128),
	`estimatedCommissionCents` int NOT NULL DEFAULT 10,
	CONSTRAINT `movie_booking_clicks_id` PRIMARY KEY(`id`)
);
