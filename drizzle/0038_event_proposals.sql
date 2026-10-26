ALTER TABLE `chat_messages`
  ADD COLUMN `messageType` enum('text','event_proposal') NOT NULL DEFAULT 'text',
  ADD COLUMN `proposalId` int;

CREATE TABLE `event_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `matchId` int NOT NULL,
  `eventId` int NOT NULL,
  `proposerId` int NOT NULL,
  `recipientId` int NOT NULL,
  `note` varchar(500),
  `status` enum('pending','accepted','declined','withdrawn') NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `respondedAt` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `event_proposals_match_idx` (`matchId`),
  KEY `event_proposals_recipient_status_idx` (`recipientId`,`status`),
  KEY `event_proposals_event_idx` (`eventId`)
);

ALTER TABLE `notifications`
  MODIFY COLUMN `type` enum('new_match','game_ready','new_message','interview_reminder','pickup_invite','event_proposal') NOT NULL;
