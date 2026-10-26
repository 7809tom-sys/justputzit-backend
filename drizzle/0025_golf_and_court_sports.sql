ALTER TABLE `venue_partners`
  MODIFY COLUMN `category` enum(
    'bowling','mini_golf','kayaking','movies','dining','coffee',
    'cooking_class','escape_room','wine_tasting','hiking','park',
    'library','church','community_center','sports','arts','swimming_pool',
    'beach','basketball','dirt_track','ymca','public_gym','golf',
    'disc_golf','volleyball','tennis','other'
  ) NOT NULL DEFAULT 'other';

ALTER TABLE `activity_listings`
  MODIFY COLUMN `category` enum(
    'bowling','mini_golf','kayaking','movies','dining','coffee',
    'cooking_class','escape_room','wine_tasting','hiking','park',
    'library','church','community_center','sports','arts','swimming_pool',
    'beach','basketball','dirt_track','ymca','public_gym','golf',
    'disc_golf','volleyball','tennis','other'
  ) NOT NULL DEFAULT 'other';
