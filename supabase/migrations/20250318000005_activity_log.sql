-- =====================================================
-- ORTHO-053: Aktivitätsprotokoll - user_id in system_logs
-- =====================================================

-- 1. user_id Spalte hinzufügen (nullable, da bestehende Einträge keinen User haben)
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Index für user_id
CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id);
