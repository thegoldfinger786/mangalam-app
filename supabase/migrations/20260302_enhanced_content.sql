-- Migration: Add enhanced fields for Bhagavad Gita content
-- Description: Adds columns for daily life application and practical examples to the verse_content table.

ALTER TABLE verse_content 
ADD COLUMN IF NOT EXISTS daily_life_application TEXT,
ADD COLUMN IF NOT EXISTS practical_examples JSONB DEFAULT '[]'::jsonb;

-- Note: We are keeping the existing 'commentary' and 'translation' columns.
-- 'translation' will now be expected to start with "This verse means".
-- 'practical_reflection' can eventually be migrated to 'daily_life_application' if needed, 
-- but for now we will support both in the UI for backward compatibility.
