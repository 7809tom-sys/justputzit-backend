CREATE TABLE `game_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `gameType` ENUM('jeopardy', 'trivia_pursuit') NOT NULL,
  `roomId` INT NOT NULL,
  `userId` INT NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `rank` INT NOT NULL,
  `isWinner` BOOLEAN NOT NULL DEFAULT FALSE,
  `completedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `game_results_room_player_unique` (`gameType`, `roomId`, `userId`)
);
