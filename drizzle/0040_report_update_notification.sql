ALTER TABLE `notifications`
  MODIFY COLUMN `type` ENUM('new_match', 'game_ready', 'new_message', 'interview_reminder', 'pickup_invite', 'event_proposal', 'report_update') NOT NULL;
