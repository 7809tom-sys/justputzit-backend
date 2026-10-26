ALTER TABLE `community_events`
  MODIFY COLUMN `category` enum('music','food','market','sports','arts','community','outdoors','comedy','karaoke','live_music','other') NOT NULL DEFAULT 'other';
