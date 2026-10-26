ALTER TABLE `community_events`
  ADD COLUMN `hasThirdWheelHost` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `thirdWheelHostNote` VARCHAR(280) NULL;
