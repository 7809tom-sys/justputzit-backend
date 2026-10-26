ALTER TABLE `game_rooms`
  MODIFY COLUMN `gameType` enum('would_you_rather','trivia','icebreaker','two_truths','finish_sentence') NOT NULL DEFAULT 'would_you_rather';
