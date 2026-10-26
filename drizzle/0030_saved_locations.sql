CREATE TABLE `saved_locations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `label` varchar(80) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(32) NOT NULL,
  `postalCode` varchar(16),
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `isHome` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `saved_locations_id` PRIMARY KEY(`id`)
);
