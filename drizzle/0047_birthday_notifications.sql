ALTER TABLE `notifications` MODIFY COLUMN `type` enum('new_match','game_ready','new_message','interview_reminder','pickup_invite','event_proposal','report_update','birthday_reminder') NOT NULL;

CREATE TABLE `birthday_notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `recipientUserId` int NOT NULL,
  `birthdayUserId` int NOT NULL,
  `matchId` int NOT NULL,
  `birthdayDateKey` varchar(10) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `birthday_notifications_id` PRIMARY KEY(`id`),
  CONSTRAINT `birthday_notifications_recipient_birthday_date_unique` UNIQUE(`recipientUserId`,`birthdayUserId`,`birthdayDateKey`)
);
