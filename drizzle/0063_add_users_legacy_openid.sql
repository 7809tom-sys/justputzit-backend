-- Keeps the member's original Manus open id after users.openId is switched to the Supabase user id.
-- Written by hand: drizzle/meta/_journal.json only tracks migrations 0000-0022, so `drizzle-kit generate`
-- would try to recreate the tables from the unjournaled files 0023-0062.
ALTER TABLE `users` ADD `legacyOpenId` varchar(64);
