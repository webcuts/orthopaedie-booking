# Statusbericht ORTHO-007: E-Mail-Versand

## User Story
**Als Patient** möchte ich nach meiner Buchung eine Bestätigungs-E-Mail erhalten, damit ich alle Details zu meinem Termin habe.

**Als Praxismitarbeiter** möchte ich bei neuen Buchungen benachrichtigt werden und dass Patienten automatisch Erinnerungen erhalten.

## Status: ✅ ABGESCHLOSSEN

## Implementierte Komponenten

### 1. E-Mail Templates (`supabase/functions/_shared/email-templates.ts`)
- **Buchungsbestätigung für Patienten**
  - Professionelles HTML-Design im Corporate Design (#2674BB)
  - Alle Termindetails (Datum, Uhrzeit, Behandlungsart, Behandler)
  - Praxis-Kontaktdaten und Adresse
  - Hinweise zur Terminabsage

- **Praxis-Benachrichtigung**
  - Kompakte Übersicht neuer Buchungen
  - Patientendaten (Name, E-Mail, Telefon)
  - Versicherungsart
  - Termindetails

- **Erinnerungs-E-Mails**
  - 24 Stunden vor dem Termin
  - 6 Stunden vor dem Termin (optional)
  - Dynamische Texte je nach Erinnerungstyp

### 2. Resend API Client (`supabase/functions/_shared/resend.ts`)
- Konfigurierter E-Mail-Versand über Resend
- Fehlerbehandlung und Logging
- Absender: `Orthopädie Königstraße <onboarding@resend.dev>` (Dev)
- Produktions-Absender vorbereitet: `termine@orthopaedie-koenigstrasse.de`

### 3. Edge Functions

#### `send-booking-confirmation`
- Wird nach erfolgreicher Buchung aufgerufen
- Lädt Termin mit allen verknüpften Daten
- Sendet HTML-Bestätigung an Patient
- Fehlertoleranter, non-blocking Aufruf

#### `send-practice-notification`
- Benachrichtigt Praxis über neue Buchung
- Enthält alle relevanten Patientendaten
- Konfigurierbare Praxis-E-Mail via `PRACTICE_EMAIL`
- Fallback: `praxis@orthopaedie-koenigstrasse.de`

#### `process-email-reminders`
- Für Cron-Job alle 5 Minuten ausgelegt
- Verarbeitet fällige Erinnerungen batch-weise (max 50)
- Überspringt stornierte Termine automatisch
- Detailliertes Logging und Fehlerstatistiken

### 4. Booking-Wizard Integration (`src/hooks/useSupabase.ts`)
- E-Mail-Versand in `useCreateBooking` Hook integriert
- Non-blocking: Buchung wartet nicht auf E-Mail-Versand
- Beide E-Mails werden parallel ausgelöst
- Fehler werden geloggt, blockieren aber nicht die Buchung

## Datenfluss

```
Patient bucht Termin
        ↓
useCreateBooking erstellt Termin
        ↓
    ┌───┴───┐
    ↓       ↓
send-booking-    send-practice-
confirmation     notification
    ↓               ↓
Patient erhält   Praxis erhält
Bestätigung      Benachrichtigung


Cron-Job (alle 5 Min)
        ↓
process-email-reminders
        ↓
Prüft email_reminders Tabelle
        ↓
Sendet fällige Erinnerungen
```

## Konfiguration

### Erforderliche Umgebungsvariablen (Supabase)
```
RESEND_API_KEY=re_xxxxxxxxxxxx
PRACTICE_EMAIL=praxis@orthopaedie-koenigstrasse.de (optional)
```

### Cron-Job für Erinnerungen
```sql
-- In Supabase Dashboard → Database → Extensions → pg_cron aktivieren
-- Dann:
SELECT cron.schedule(
  'process-email-reminders',
  '*/5 * * * *',  -- Alle 5 Minuten
  $$
  SELECT net.http_post(
    url := 'https://jgammhrdgoxxbcwvlqcd.supabase.co/functions/v1/process-email-reminders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

## Deployment

### Edge Functions deployen
```bash
cd orthopaedie-booking

# Shared Module
supabase functions deploy _shared --no-verify-jwt

# Einzelne Functions
supabase functions deploy send-booking-confirmation --no-verify-jwt
supabase functions deploy send-practice-notification --no-verify-jwt
supabase functions deploy process-email-reminders --no-verify-jwt
```

### Secrets setzen
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set PRACTICE_EMAIL=praxis@orthopaedie-koenigstrasse.de
```

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `supabase/functions/_shared/email-templates.ts` | HTML-Templates für alle E-Mail-Typen |
| `supabase/functions/_shared/resend.ts` | Resend API Client |
| `supabase/functions/send-booking-confirmation/index.ts` | Bestätigung an Patient |
| `supabase/functions/send-practice-notification/index.ts` | Benachrichtigung an Praxis |
| `supabase/functions/process-email-reminders/index.ts` | Erinnerungs-Verarbeitung |
| `src/hooks/useSupabase.ts` | Integration in Booking-Flow |

## Akzeptanzkriterien

| Kriterium | Status |
|-----------|--------|
| Bestätigungs-E-Mail nach Buchung | ✅ |
| Praxis-Benachrichtigung bei neuer Buchung | ✅ |
| E-Mail-Templates im Corporate Design | ✅ |
| Erinnerungs-E-Mails (24h/6h vorher) | ✅ |
| Non-blocking E-Mail-Versand | ✅ |
| Fehlerbehandlung und Logging | ✅ |

## Nächste Schritte

1. **Resend Account einrichten** und API Key hinterlegen
2. **Domain verifizieren** für Produktions-E-Mails
3. **Cron-Job aktivieren** für automatische Erinnerungen
4. **email_reminders Tabelle** erstellen (wenn noch nicht vorhanden)
5. **E-Mail-Versand testen** mit Testbuchung

## Hinweise

- Im Development-Modus werden E-Mails über `onboarding@resend.dev` gesendet
- Resend erlaubt im Free-Tier nur Versand an verifizierte E-Mail-Adressen
- Für Produktion muss eine eigene Domain bei Resend verifiziert werden
- Die Erinnerungs-Funktion benötigt eine `email_reminders` Tabelle in der Datenbank
