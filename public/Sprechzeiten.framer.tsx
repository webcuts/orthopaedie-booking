// Sprechzeiten & OP-Tage — Framer Code Component
// Diesen Code in Framer unter Assets → Code → neue Datei einfügen

import { useEffect, useState } from "react"

const SUPABASE_URL = "https://jgammhrdgoxxbcwvlqcd.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_Ww1hByyP9FrP4mCoj7-Uvg_tDPmW1Hg"

// practitioner_schedules: JS getDay() → 0=So, 1=Mo, ..., 6=Sa
const SCHEDULE_DAY_NAMES: Record<number, string> = {
    1: "Mo",
    2: "Di",
    3: "Mi",
    4: "Do",
    5: "Fr",
    6: "Sa",
    0: "So",
}
const SCHEDULE_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mo–So

// practice_hours: 0=Mo, 1=Di, ..., 6=So
const HOURS_DAY_NAMES: Record<number, string> = {
    0: "Mo",
    1: "Di",
    2: "Mi",
    3: "Do",
    4: "Fr",
    5: "Sa",
    6: "So",
}

interface Practitioner {
    id: string
    title: string | null
    first_name: string
    last_name: string
}

interface Schedule {
    id: string
    practitioner_id: string
    day_of_week: number
    start_time: string
    end_time: string
    is_bookable: boolean
    insurance_filter: "all" | "private_only"
    label: string | null
}

interface PracticeHour {
    day_of_week: number
    open_time: string
    close_time: string
    is_closed: boolean
}

function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(":")
    return parseInt(h, 10) + ":" + m
}

function practitionerName(p: Practitioner): string {
    return ((p.title || "") + " " + p.first_name + " " + p.last_name).trim()
}

function entryLabel(s: Schedule): string {
    if (s.is_bookable && s.insurance_filter === "private_only") {
        return "Privatsprechstunde"
    }
    if (s.is_bookable) {
        return "Online buchbar"
    }
    return s.label || "Sprechstunde"
}

function entryColor(s: Schedule): string {
    if (s.is_bookable && s.insurance_filter === "private_only") return "#7C3AED"
    if (s.is_bookable) return "#059669"
    return "#6B7280"
}

function dotColor(s: Schedule): string {
    if (s.is_bookable && s.insurance_filter === "private_only") return "#A78BFA"
    if (s.is_bookable) return "#34D399"
    return "#D1D5DB"
}

// ── Styles ──────────────────────────────────────────

const styles = {
    container: {
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        color: "#1F2937",
        width: "100%",
    } as React.CSSProperties,
    card: {
        background: "#FFFFFF",
        borderRadius: 10,
        padding: "20px 24px",
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #E5E7EB",
    } as React.CSSProperties,
    name: {
        fontSize: 16,
        fontWeight: 700,
        color: "#1F2937",
        margin: "0 0 12px 0",
    } as React.CSSProperties,
    dayRow: {
        display: "flex",
        alignItems: "baseline",
        padding: "4px 0",
        gap: 8,
    } as React.CSSProperties,
    dayLabel: {
        fontWeight: 600,
        color: "#374151",
        minWidth: 28,
        flexShrink: 0,
    } as React.CSSProperties,
    entries: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 6,
        alignItems: "center",
    } as React.CSSProperties,
    fallback: {
        fontSize: 14,
        color: "#6B7280",
        fontStyle: "italic" as const,
    } as React.CSSProperties,
    sectionTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: "#374151",
        margin: "0 0 12px 0",
    } as React.CSSProperties,
    hoursRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "3px 0",
        fontSize: 14,
    } as React.CSSProperties,
    hoursDay: {
        fontWeight: 600,
        color: "#374151",
    } as React.CSSProperties,
    hoursTime: {
        color: "#6B7280",
    } as React.CSSProperties,
    loading: {
        textAlign: "center" as const,
        padding: 24,
        color: "#9CA3AF",
    } as React.CSSProperties,
    legend: {
        display: "flex",
        gap: 16,
        flexWrap: "wrap" as const,
        marginBottom: 16,
        fontSize: 13,
        color: "#6B7280",
    } as React.CSSProperties,
    legendItem: {
        display: "flex",
        alignItems: "center",
        gap: 6,
    } as React.CSSProperties,
}

function Badge({
    schedule,
}: {
    schedule: Schedule
}) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 13,
                color: entryColor(schedule),
                whiteSpace: "nowrap",
            }}
        >
            <span
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: dotColor(schedule),
                    flexShrink: 0,
                }}
            />
            {entryLabel(schedule)} {formatTime(schedule.start_time)}–
            {formatTime(schedule.end_time)}
        </span>
    )
}

export default function Sprechzeiten() {
    const [practitioners, setPractitioners] = useState<Practitioner[]>([])
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [hours, setHours] = useState<PracticeHour[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0]

        const headers = {
            apikey: SUPABASE_ANON_KEY,
            Authorization: "Bearer " + SUPABASE_ANON_KEY,
        }

        Promise.all([
            fetch(
                SUPABASE_URL +
                    "/rest/v1/practitioners?select=id,title,first_name,last_name&is_active=eq.true&order=last_name",
                { headers }
            ).then((r) => r.json()),
            fetch(
                SUPABASE_URL +
                    "/rest/v1/practitioner_schedules?select=*&valid_from=lte." +
                    today +
                    "&or=(valid_until.is.null,valid_until.gte." +
                    today +
                    ")&order=day_of_week,start_time",
                { headers }
            ).then((r) => r.json()),
            fetch(
                SUPABASE_URL +
                    "/rest/v1/practice_hours?select=*&is_closed=eq.false&order=day_of_week",
                { headers }
            ).then((r) => r.json()),
        ])
            .then(([pracs, scheds, hrs]) => {
                if (Array.isArray(pracs)) setPractitioners(pracs)
                if (Array.isArray(scheds)) setSchedules(scheds)
                if (Array.isArray(hrs)) setHours(hrs)
            })
            .catch((err) =>
                console.warn("[sprechzeiten] Fehler:", err)
            )
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return <div style={styles.loading}>Lade Sprechzeiten...</div>
    }

    // Group schedules by practitioner
    const byPractitioner: Record<string, Schedule[]> = {}
    for (const s of schedules) {
        if (!byPractitioner[s.practitioner_id]) {
            byPractitioner[s.practitioner_id] = []
        }
        byPractitioner[s.practitioner_id].push(s)
    }

    return (
        <div style={styles.container}>
            {/* Legende */}
            <div style={styles.legend}>
                <span style={styles.legendItem}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#34D399",
                        }}
                    />
                    Online buchbar
                </span>
                <span style={styles.legendItem}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#A78BFA",
                        }}
                    />
                    Privatsprechstunde
                </span>
                <span style={styles.legendItem}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#D1D5DB",
                        }}
                    />
                    Nicht buchbar
                </span>
            </div>

            {/* Behandler-Karten */}
            {practitioners.map((p) => {
                const pSchedules = byPractitioner[p.id]
                const hasSchedules = pSchedules && pSchedules.length > 0

                // Group by day
                const byDay: Record<number, Schedule[]> = {}
                if (hasSchedules) {
                    for (const s of pSchedules) {
                        if (!byDay[s.day_of_week])
                            byDay[s.day_of_week] = []
                        byDay[s.day_of_week].push(s)
                    }
                }

                return (
                    <div key={p.id} style={styles.card}>
                        <p style={styles.name}>{practitionerName(p)}</p>
                        {hasSchedules ? (
                            SCHEDULE_DAY_ORDER.filter(
                                (d) => byDay[d]
                            ).map((day) => (
                                <div key={day} style={styles.dayRow}>
                                    <span style={styles.dayLabel}>
                                        {SCHEDULE_DAY_NAMES[day]}:
                                    </span>
                                    <span style={styles.entries}>
                                        {byDay[day].map((s) => (
                                            <Badge
                                                key={s.id}
                                                schedule={s}
                                            />
                                        ))}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p style={styles.fallback}>
                                Termine nach Vereinbarung während
                                der Praxisöffnungszeiten
                            </p>
                        )}
                    </div>
                )
            })}

            {/* Praxisöffnungszeiten */}
            <div style={styles.card}>
                <p style={styles.sectionTitle}>
                    Praxisöffnungszeiten
                </p>
                {hours.map((h) => (
                    <div key={h.day_of_week} style={styles.hoursRow}>
                        <span style={styles.hoursDay}>
                            {HOURS_DAY_NAMES[h.day_of_week]}
                        </span>
                        <span style={styles.hoursTime}>
                            {formatTime(h.open_time)}–
                            {formatTime(h.close_time)} Uhr
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
