-- =====================================================
-- Migration: DB-Trigger trigger_cancel_appointments_on_absence ENTFERNEN
-- =====================================================
-- Original aus 20250130000005_practitioner_absences.sql.
-- Probleme:
--   1. Ignoriert start_time/end_time → bei halbtägigen Abwesenheiten wird
--      der GANZE TAG storniert, statt nur das gemeinte Zeitfenster.
--   2. Storniert ohne Patienten-Benachrichtigung (DB-Trigger können keine
--      Edge Functions invoken). Patienten sehen ihren Termin im Kalender
--      nicht mehr, bekommen aber nie eine Absage-Mail.
--   3. Konfligiert mit dem neuen Frontend-Flow (cancelAppointmentsForAbsence
--      in AbsenceManager): der DB-Trigger storniert vor dem Frontend-Code,
--      der findet danach 0 zu bearbeitende Termine, sendet keine Mails.
--
-- Ersatz: Das Stornieren + Mails-Versenden passiert jetzt im Frontend
-- (AbsenceManager Auto-Prompt nach createAbsence). Halbtägig-aware.
--
-- Konkreter Vorfall am 16.06.2026: 78 Termine vom Trigger storniert ohne
-- Mails. 26 Patienten mit E-Mail wurden nachträglich per Script benachrichtigt
-- (siehe scripts/resend-flores-cancellation.py), 52 ohne E-Mail brauchen
-- telefonische Info (Liste auf Desktop exportiert).

DROP TRIGGER IF EXISTS trigger_cancel_appointments_on_absence ON practitioner_absences;
DROP FUNCTION IF EXISTS cancel_appointments_for_absence();
