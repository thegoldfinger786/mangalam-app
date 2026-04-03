-- 1. SECURITY: Harden function search_path to prevent path injection
-- Addresses: function_search_path_mutable
ALTER FUNCTION public.increment_daily_usage(p_user_id UUID, p_date DATE) SET search_path = public;

-- 2. SECURITY: Remove insecure "allow-all" write access for public users
-- Addresses: rls_policy_always_true
DROP POLICY IF EXISTS verses_insert_public ON public.verses;
DROP POLICY IF EXISTS verses_update_public ON public.verses;

-- 3. PERFORMANCE: Index missing foreign key to speed up progress lookups
-- Addresses: unindexed_foreign_keys
CREATE INDEX IF NOT EXISTS idx_user_progress_book_id ON public.user_progress (book_id);

-- 4. PERFORMANCE: Optimize user_daily_usage RLS with subqueries
-- Addresses: auth_rls_initplan
DROP POLICY IF EXISTS user_daily_usage_insert_own ON public.user_daily_usage;
DROP POLICY IF EXISTS user_daily_usage_read_own ON public.user_daily_usage;
DROP POLICY IF EXISTS user_daily_usage_update_own ON public.user_daily_usage;

CREATE POLICY user_daily_usage_insert_own ON public.user_daily_usage
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_daily_usage_read_own ON public.user_daily_usage
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_daily_usage_update_own ON public.user_daily_usage
    FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- 5. PERFORMANCE: Optimize user_progress RLS with subqueries
-- Addresses: auth_rls_initplan
DROP POLICY IF EXISTS "Users can edit their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;

CREATE POLICY "user_progress_insert_own" ON public.user_progress
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_progress_select_own" ON public.user_progress
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_progress_update_own" ON public.user_progress
    FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- 6. PERFORMANCE: Consolidate redundant scripture policies
-- Addresses: multiple_permissive_policies
-- Books
DROP POLICY IF EXISTS books_read_authenticated ON public.books;
DROP POLICY IF EXISTS books_read_public ON public.books;
CREATE POLICY books_read_public ON public.books FOR SELECT USING (is_active = true);

-- Verses
DROP POLICY IF EXISTS verses_read_authenticated ON public.verses;
DROP POLICY IF EXISTS verses_read_public ON public.verses;
CREATE POLICY verses_read_public ON public.verses FOR SELECT USING (true);

-- 7. PERFORMANCE: Remove unused indexes to improve write speed
-- Addresses: unused_index
DROP INDEX IF EXISTS idx_episodes_book;
DROP INDEX IF EXISTS idx_episode_content_episode;
