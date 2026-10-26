CREATE TABLE `activity_bookmarks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `activityId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_bookmarks_user_activity_unique` (`userId`,`activityId`)
);
