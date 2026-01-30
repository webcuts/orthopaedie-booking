# Datenbankschema - Orthopädie Terminbuchungssystem

## Übersicht

Das Datenbankschema unterstützt ein Terminbuchungssystem für eine orthopädische Praxis.
Alle Daten werden in Supabase (Region: Frankfurt, eu-central-1) gespeichert.

**Migrationen:**
- `20250130000001_initial_schema.sql` - Basis-Schema (ORTHO-001)
- `20250130000002_schema_extension.sql` - Erweiterung (ORTHO-004)

## ER-Diagramm

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   specialties   │     │ insurance_types  │     │ treatment_types  │
├─────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)         │     │ id (PK)          │     │ id (PK)          │
│ name            │     │ name             │     │ name             │
│ is_active       │     │ is_active        │     │ duration_minutes │
└────────┬────────┘     └────────┬─────────┘     │ description      │
         │                       │               │ is_active        │
         ▼                       ▼               └────────┬─────────┘
┌─────────────────┐     ┌─────────────────┐              │
│  practitioners  │     │    patients     │              │
├─────────────────┤     ├─────────────────┤              │
│ id (PK)         │     │ id (PK)         │              │
│ title           │     │ name            │              │
│ first_name      │     │ email           │              │
│ last_name       │     │ phone           │              │
│ specialty_id(FK)│     │ insurance_type  │              │
│ is_active       │     │ created_at      │              │
│ available_from  │     └────────┬────────┘              │
└────────┬────────┘              │                       │
         │                       │                       │
         │              ┌────────▼───────────────────────▼─┐
         │              │         appointments             │
         └─────────────►├──────────────────────────────────┤
                        │ id (PK)                          │
                        │ patient_id (FK)                  │
                        │ treatment_type_id (FK)           │
                        │ time_slot_id (FK)                │
                        │ practitioner_id (FK)             │
                        │ status                           │
                        │ notes                            │
                        │ cancellation_deadline            │
                        │ created_at, updated_at           │
                        └────────┬─────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   time_slots     │    │ email_reminders  │    │  practice_hours  │
├──────────────────┤    ├──────────────────┤    ├──────────────────┤
│ id (PK)          │    │ id (PK)          │    │ id (PK)          │
│ date             │    │ appointment_id   │    │ day_of_week      │
│ start_time       │    │ reminder_type    │    │ open_time        │
│ end_time         │    │ scheduled_for    │    │ close_time       │
│ is_available     │    │ sent_at          │    │ is_closed        │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Tabellen

### specialties

Medizinische Fachgebiete der Praxis.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `name` | TEXT | Name des Fachgebiets (unique) |
| `is_active` | BOOLEAN | Aktiv/Inaktiv |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

**Vorbelegte Werte:**
- Orthopäde und Unfallchirurg
- Physikalischer und Rehabilitativer Mediziner

---

### practitioners

Behandler/Ärzte der Praxis.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `title` | TEXT | Titel (z.B. "Dr. med.") |
| `first_name` | TEXT | Vorname |
| `last_name` | TEXT | Nachname |
| `specialty_id` | UUID | FK → specialties |
| `is_active` | BOOLEAN | Aktiv/Inaktiv |
| `available_from` | DATE | Verfügbar ab (NULL = sofort) |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

**Vorbelegte Behandler:**
| Name | Fachgebiet | Verfügbar ab |
|------|------------|--------------|
| Dr. med. Yilmaz Ercan | Orthopäde und Unfallchirurg | sofort |
| Dr. med. Michael Jonda | Orthopäde und Unfallchirurg | sofort |
| Vladimir Flores | Orthopäde und Unfallchirurg | sofort |
| Yulia Namakonova | Phys. und Rehab. Mediziner | sofort |
| Jwan Mohammed | Orthopäde und Unfallchirurg | 01.05.2026 |

---

### practice_hours

Öffnungszeiten der Praxis pro Wochentag.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `day_of_week` | INTEGER | Wochentag (0=Montag, 6=Sonntag) |
| `open_time` | TIME | Öffnungszeit |
| `close_time` | TIME | Schließzeit |
| `is_closed` | BOOLEAN | Geschlossen (z.B. Sonntag) |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

**Vorbelegte Öffnungszeiten:**
| Tag | Öffnet | Schließt |
|-----|--------|----------|
| Montag | 07:45 | 17:30 |
| Dienstag | 07:45 | 17:30 |
| Mittwoch | 07:45 | 12:30 |
| Donnerstag | 07:45 | 17:30 |
| Freitag | 07:45 | 16:45 |
| Samstag | 08:00 | 15:00 |
| Sonntag | geschlossen | - |

---

### email_reminders

Queue für E-Mail-Erinnerungen vor Terminen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `appointment_id` | UUID | FK → appointments (CASCADE DELETE) |
| `reminder_type` | reminder_type | Art der Erinnerung |
| `scheduled_for` | TIMESTAMPTZ | Geplanter Versandzeitpunkt |
| `sent_at` | TIMESTAMPTZ | Tatsächlicher Versand (NULL = ausstehend) |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

**Reminder-Enum (reminder_type):**
- `24h_before` - 24 Stunden vor Termin
- `6h_before` - 6 Stunden vor Termin

**Automatik:** Erinnerungen werden automatisch bei Terminbuchung erstellt (Trigger).

---

### insurance_types

Versicherungsarten der Patienten.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `name` | VARCHAR(100) | Name der Versicherungsart (unique) |
| `is_active` | BOOLEAN | Aktiv/verfügbar für Auswahl |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

**Vorbelegte Werte:**
- Gesetzlich versichert
- Privat versichert

---

### patients

Patientendaten für Terminbuchungen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `name` | VARCHAR(255) | Vollständiger Name |
| `email` | VARCHAR(255) | E-Mail-Adresse |
| `phone` | VARCHAR(50) | Telefonnummer (optional) |
| `insurance_type_id` | UUID | FK → insurance_types |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

---

### treatment_types

Verfügbare Terminarten der Praxis.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `name` | VARCHAR(255) | Name der Behandlung |
| `duration_minutes` | INTEGER | Dauer in Minuten |
| `description` | TEXT | Beschreibung für Patienten |
| `is_active` | BOOLEAN | Aktiv/buchbar |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

**Vorbelegte Terminarten:**
| Name | Dauer | Beschreibung |
|------|-------|--------------|
| Erstuntersuchung Neupatient | 15 Min. | Ersttermin für neue Patienten |
| Sprechstunde | 10 Min. | Kontrolltermin für Bestandspatienten |
| Rezepte | 5 Min. | Rezeptabholung |

---

### time_slots

Verfügbare Zeitfenster für Terminbuchungen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `date` | DATE | Datum des Zeitfensters |
| `start_time` | TIME | Startzeit |
| `end_time` | TIME | Endzeit |
| `is_available` | BOOLEAN | Verfügbar für Buchung |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |

---

### appointments

Gebuchte Termine mit Status-Tracking.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `patient_id` | UUID | FK → patients (CASCADE DELETE) |
| `treatment_type_id` | UUID | FK → treatment_types |
| `time_slot_id` | UUID | FK → time_slots (UNIQUE) |
| `practitioner_id` | UUID | FK → practitioners |
| `status` | appointment_status | Status des Termins |
| `notes` | TEXT | Notizen zum Termin |
| `cancellation_deadline` | TIMESTAMPTZ | Stornierungsfrist (auto) |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMPTZ | Letzte Aktualisierung |

**Status-Enum (appointment_status):**
- `pending` - Ausstehend/Neu gebucht
- `confirmed` - Von Praxis bestätigt
- `cancelled` - Storniert
- `completed` - Durchgeführt

**Stornierungsregel:**
Patienten können bis 12 Stunden vor dem Termin selbst stornieren (`cancellation_deadline`).

---

## Automatische Trigger

### set_cancellation_deadline
Setzt bei Buchung automatisch `cancellation_deadline` auf Terminzeit minus 12 Stunden.

### create_email_reminders
Erstellt bei Buchung automatisch zwei Erinnerungen (24h und 6h vor Termin).

### update_updated_at_column
Aktualisiert `updated_at` bei Änderungen an Terminen.

---

## Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert.

### Öffentlicher Zugriff (anon)

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| specialties | ✅ (aktive) | ❌ | ❌ | ❌ |
| practitioners | ✅ (aktive, verfügbar) | ❌ | ❌ | ❌ |
| practice_hours | ✅ | ❌ | ❌ | ❌ |
| email_reminders | ❌ | ❌ | ❌ | ❌ |
| insurance_types | ✅ (aktive) | ❌ | ❌ | ❌ |
| patients | ❌ | ✅ | ❌ | ❌ |
| treatment_types | ✅ (aktive) | ❌ | ❌ | ❌ |
| time_slots | ✅ | ❌ | ✅ | ❌ |
| appointments | ❌ | ✅ | ❌ | ❌ |

### Authentifizierter Zugriff (authenticated/Admin)

Voller CRUD-Zugriff auf alle Tabellen.

---

## Konventionen

- **Tabellennamen:** snake_case, Plural (z.B. `time_slots`)
- **Spaltennamen:** snake_case (z.B. `created_at`)
- **Primärschlüssel:** UUID mit `gen_random_uuid()`
- **Timestamps:** TIMESTAMPTZ in UTC
- **Fremdschlüssel:** `<tabelle>_id` (z.B. `patient_id`)
- **Wochentage:** 0 = Montag, 6 = Sonntag
