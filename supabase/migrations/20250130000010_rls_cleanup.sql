-- =====================================================
-- Migration 010: RLS Policy Cleanup
-- Entfernt überflüssige/unsichere Policies
-- =====================================================

-- 1. Anon UPDATE auf time_slots entfernen
-- Der block_slot_on_booking Trigger (Migration 006, SECURITY DEFINER in 007)
-- setzt is_available=false automatisch. Anon braucht keinen direkten UPDATE.
DROP POLICY IF EXISTS "Anon can book available slots" ON time_slots;
DROP POLICY IF EXISTS "time_slots_anon_update" ON time_slots;

-- 2. slot_generation_logs: Public-Read entfernen
-- Operational Logs sollten nicht öffentlich einsehbar sein.
DROP POLICY IF EXISTS "slot_generation_logs_public_read" ON slot_generation_logs;
