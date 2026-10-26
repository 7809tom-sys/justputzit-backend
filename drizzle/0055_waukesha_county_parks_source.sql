ALTER TABLE `community_events`
  MODIFY COLUMN `source` enum(
    'community', 'eventbrite', 'admin', 'milwaukee_library', 'waukesha_library',
    'waukesha_county_parks', 'uwm', 'marquette', 'onmilwaukee', 'scraped',
    'jsonline', 'milwaukee_journal', 'waukesha_freeman', 'newspaper', 'college',
    'university', 'church', 'senior_center', 'youth_group', 'neighborhood',
    'general', 'chicago_library', 'chicago_museum'
  ) NOT NULL DEFAULT 'admin';
