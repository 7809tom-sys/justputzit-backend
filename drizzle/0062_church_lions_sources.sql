ALTER TABLE `community_events`
  MODIFY COLUMN `source` enum(
    'community','eventbrite','admin','milwaukee_library','waukesha_library',
    'waukesha_county_parks','brookfield_library','visit_waukesha','downtown_waukesha',
    'waukesha_chamber','la_crosse_library','la_crosse_parks','uwm','marquette',
    'onmilwaukee','scraped','jsonline','milwaukee_journal','waukesha_freeman',
    'newspaper','college','university','church','lions_club','senior_center',
    'youth_group','neighborhood','general','chicago_library','chicago_museum'
  ) NOT NULL DEFAULT 'admin';
