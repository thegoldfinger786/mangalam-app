-- gita_title_dedup.sql
-- Post-backfill cleanup for CONTENT-01 (generate-gita-titles).
--
-- The Gemini backfill produced two collisions among 701 verses, both between
-- consecutive verses that cover the same idea:
--   • EN 3.21 / 3.23  → both "Leaders' Actions Shape Society's Path"
--   • HI 12.14 / 12.16 → both "कृष्ण को प्रिय भक्त के गुण"
--     (EN 12.14 / 12.16 also differed only by "a"/"the")
--
-- Hand-written distinct titles, applied to BOTH verse_content and content_master
-- (same value per (verse_id, language)), consistent with the backfill's own
-- two-table write. Archived here per CLAUDE.md §5 (manual edits are an
-- accepted exception path and must be saved for auditability).
--
-- Applied 2026-08-30 via `supabase db query --linked`.

-- ── BG 3.23 ────────────────────────────────────────────────────────────────
update verse_content vc set title = 'Krishna Keeps Working So Others Follow Wisely', updated_at = now()
from verses v where v.verse_id = vc.verse_id
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and v.chapter_no = 3 and v.verse_no = 23 and vc.language = 'en';
update verse_content vc set title = 'कृष्ण स्वयं सचेत होकर कर्म क्यों करते हैं', updated_at = now()
from verses v where v.verse_id = vc.verse_id
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and v.chapter_no = 3 and v.verse_no = 23 and vc.language = 'hi';

-- ── BG 12.14 ───────────────────────────────────────────────────────────────
update verse_content vc set title = 'The Steady, Contented Devotee Dear to Krishna', updated_at = now()
from verses v where v.verse_id = vc.verse_id
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and v.chapter_no = 12 and v.verse_no = 14 and vc.language = 'en';
update verse_content vc set title = 'संतुष्ट और समर्पित भक्त कृष्ण को प्रिय', updated_at = now()
from verses v where v.verse_id = vc.verse_id
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and v.chapter_no = 12 and v.verse_no = 14 and vc.language = 'hi';

-- ── BG 12.16 ───────────────────────────────────────────────────────────────
update verse_content vc set title = 'Free From Wants and Worry, Dear to Krishna', updated_at = now()
from verses v where v.verse_id = vc.verse_id
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and v.chapter_no = 12 and v.verse_no = 16 and vc.language = 'en';
update verse_content vc set title = 'अपेक्षारहित और निश्चिंत भक्त कृष्ण को प्रिय', updated_at = now()
from verses v where v.verse_id = vc.verse_id
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and v.chapter_no = 12 and v.verse_no = 16 and vc.language = 'hi';

-- Mirror all six into content_master.
update content_master cm set title = vc.title, updated_at = now()
from verse_content vc join verses v on v.verse_id = vc.verse_id
where cm.verse_id = vc.verse_id and cm.language = vc.language
  and v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and ((v.chapter_no = 3 and v.verse_no = 23) or (v.chapter_no = 12 and v.verse_no in (14, 16)));
