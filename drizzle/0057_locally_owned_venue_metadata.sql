ALTER TABLE `venue_partners`
  ADD COLUMN `is_locally_owned` boolean NOT NULL DEFAULT false,
  ADD COLUMN `ownership_note` varchar(300);
