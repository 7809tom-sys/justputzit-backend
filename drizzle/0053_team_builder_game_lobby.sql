ALTER TABLE `game_rooms`
  MODIFY COLUMN `gameType` enum('would_you_rather','trivia','icebreaker','two_truths','finish_sentence','bullgerdash','team_builder') NOT NULL DEFAULT 'would_you_rather';
