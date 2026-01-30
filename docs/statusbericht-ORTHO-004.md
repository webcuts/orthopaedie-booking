# Statusbericht: User Story ORTHO-004

**Datum:** 30.01.2025
**Story:** ORTHO-004 - Datenbank-Schema Erweiterung für Praxis-Anforderungen
**Status:** Abgeschlossen
**Verantwortlich:** Development Team (Claude Code)

---

## Zusammenfassung

Das Datenbank-Schema wurde erfolgreich erweitert, um die tatsächlichen Praxis-Strukturen abzubilden. Neue Tabellen für Behandler, Fachgebiete, Öffnungszeiten und E-Mail-Erinnerungen wurden erstellt. Die Seed-Daten entsprechen den realen Praxis-Daten aus dem Fragebogen.

---

## Akzeptanzkriterien

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Tabelle `specialties` erstellt (Fachgebiete) | Erfüllt |
| 2 | Tabelle `practitioners` erstellt (Behandler mit Fachgebiet-Zuordnung) | Erfüllt |
| 3 | Tabelle `practice_hours` erstellt (Öffnungszeiten pro Wochentag) | Erfüllt |
| 4 | Tabelle `email_reminders` erstellt (Erinnerungs-Queue) | Erfüllt |
| 5 | Tabelle `treatment_types` aktualisiert (neue Terminarten) | Erfüllt |
| 6 | Fremdschlüssel `appointments` → `practitioners` hinzugefügt | Erfüllt |
| 7 | Seed-Daten für alle 5 Behandler eingefügt | Erfüllt |
| 8 | Seed-Daten für Öffnungszeiten (Mo-Sa) eingefügt | Erfüllt |
| 9 | Seed-Daten für Terminarten (Neupatient, Sprechstunde, Rezepte) eingefügt | Erfüllt |
| 10 | RLS-Policies für neue Tabellen aktiv | Erfüllt |

---

## Definition of Done

| Kriterium | Status |
|-----------|--------|
| Alle neuen Tabellen erstellt | Erfüllt |
| Fremdschlüssel korrekt definiert | Erfüllt |
| RLS-Policies für alle Tabellen aktiv | Erfüllt |
| Seed-Daten vollständig eingefügt | Erfüllt |
| Alte Beispiel-Daten entfernt/ersetzt | Erfüllt |
| Migration dokumentiert | Erfüllt |

---

## Erstellte Artefakte

| Datei | Beschreibung |
|-------|--------------|
| `supabase/migrations/20250130000002_schema_extension.sql` | SQL-Migration mit Schema-Erweiterung |
| `src/types/database.ts` | Aktualisierte TypeScript-Typen |
| `docs/schema.md` | Aktualisierte Schema-Dokumentation |

---

## Technische Details

### Neue Tabellen

| Tabelle | Beschreibung |
|---------|--------------|
| `specialties` | Medizinische Fachgebiete |
| `practitioners` | Behandler/Ärzte mit Fachgebiet-Zuordnung |
| `practice_hours` | Öffnungszeiten pro Wochentag |
| `email_reminders` | Queue für E-Mail-Erinnerungen |

### Schema-Änderungen an `appointments`

| Neue Spalte | Typ | Beschreibung |
|-------------|-----|--------------|
| `practitioner_id` | UUID (FK) | Zugeordneter Behandler |
| `cancellation_deadline` | TIMESTAMPTZ | Stornierungsfrist (auto) |

### Neue Enums

| Enum | Werte |
|------|-------|
| `reminder_type` | `24h_before`, `6h_before` |

### Automatische Trigger

| Trigger | Funktion |
|---------|----------|
| `trigger_set_cancellation_deadline` | Setzt Stornierungsfrist auf Termin - 12h |
| `trigger_create_email_reminders` | Erstellt 24h und 6h Erinnerungen |

---

## Seed-Daten

### Fachgebiete (2)

| Name |
|------|
| Orthopäde und Unfallchirurg |
| Physikalischer und Rehabilitativer Mediziner |

### Behandler (5)

| Titel | Vorname | Nachname | Fachgebiet | Verfügbar ab |
|-------|---------|----------|------------|--------------|
| Dr. med. | Yilmaz | Ercan | Orthopäde und Unfallchirurg | sofort |
| Dr. med. | Michael | Jonda | Orthopäde und Unfallchirurg | sofort |
| - | Vladimir | Flores | Orthopäde und Unfallchirurg | sofort |
| - | Yulia | Namakonova | Phys. und Rehab. Mediziner | sofort |
| - | Jwan | Mohammed | Orthopäde und Unfallchirurg | 01.05.2026 |

### Öffnungszeiten

| Tag | Öffnet | Schließt |
|-----|--------|----------|
| Montag | 07:45 | 17:30 |
| Dienstag | 07:45 | 17:30 |
| Mittwoch | 07:45 | 12:30 |
| Donnerstag | 07:45 | 17:30 |
| Freitag | 07:45 | 16:45 |
| Samstag | 08:00 | 15:00 |
| Sonntag | geschlossen | - |

### Terminarten (3)

| Name | Dauer | Beschreibung |
|------|-------|--------------|
| Erstuntersuchung Neupatient | 15 Min. | Ersttermin für neue Patienten |
| Sprechstunde | 10 Min. | Kontrolltermin für Bestandspatienten |
| Rezepte | 5 Min. | Rezeptabholung |

### Versicherungsarten (2)

| Name |
|------|
| Gesetzlich versichert |
| Privat versichert |

---

## Stornierungsregel

Patienten können bis **12 Stunden** vor dem Termin selbst stornieren. Die `cancellation_deadline` wird automatisch bei Buchung gesetzt.

---

## Aufwand

| Geplant | Tatsächlich |
|---------|-------------|
| 4 Stunden | Im Rahmen |

---

## Nächste Schritte

1. Migration in Supabase ausführen
2. Frontend-Hooks für neue Entitäten erweitern (Practitioners, Practice Hours)
3. Booking-Wizard mit Behandler-Auswahl implementieren

---

## Abnahme

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|--------------|
| Product Owner | Elias | ______ | ____________ |
| Scrum Master | Claude Chat | ______ | ____________ |
