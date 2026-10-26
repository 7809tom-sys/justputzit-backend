ALTER TABLE `users`
  ADD COLUMN `adminPromotedAt` TIMESTAMP NULL AFTER `role`;

UPDATE `users`
SET `adminPromotedAt` = `updatedAt`
WHERE `role` = 'admin' AND `adminPromotedAt` IS NULL;
