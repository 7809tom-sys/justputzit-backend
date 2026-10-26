CREATE TABLE IF NOT EXISTS `todays_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `eventId` int NULL,
  `activityId` int NULL,
  `note` varchar(255) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `todays_plans_userId_unique` (`userId`)
);
