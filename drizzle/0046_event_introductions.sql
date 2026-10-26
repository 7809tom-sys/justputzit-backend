CREATE TABLE `event_introductions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventId` int NOT NULL,
  `lowerUserId` int NOT NULL,
  `higherUserId` int NOT NULL,
  `matchId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `event_introductions_id` PRIMARY KEY(`id`),
  CONSTRAINT `event_introductions_pair_unique` UNIQUE(`eventId`,`lowerUserId`,`higherUserId`)
);
