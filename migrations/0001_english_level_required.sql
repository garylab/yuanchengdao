ALTER TABLE jobs ADD COLUMN english_level_required TEXT NOT NULL DEFAULT 'none' CHECK (english_level_required IN (
  'none', 'basic', 'intermediate', 'upper_intermediate', 'B2', 'C1', 'C2', 'advanced', 'fluent', 'native'
));
