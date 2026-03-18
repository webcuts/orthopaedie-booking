// ORTHO-047: OP-Tage Dr. Ercan dynamisch auf Website
// Einbindung: Framer → Code → New File → Inhalt einfügen
// Dann als Component auf die Startseite ziehen (Mitte, oberhalb Terminbuchung)

import { useState, useEffect } from "react"

// === KONFIGURATION ===
const SUPABASE_URL = "https://jgammhrdgoxxbcwvlqcd.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_Ww1hByyP9FrP4mCoj7-Uvg_tDPmW1Hg"

const MESSAGES = {
    monday: {
        title: "Hinweis",
        text: "Dr. med. Yilmaz Ercan ist heute im OP und in der Praxis nicht verfügbar.",
    },
    wednesday: {
        title: "Hinweis",
        text: "Dr. med. Yilmaz Ercan ist ab Nachmittag im OP.",
    },
}
// === ENDE KONFIGURATION ===

export default function OpTageErcan() {
    const [visible, setVisible] = useState(false)
    const [title, setTitle] = useState("")
    const [text, setText] = useState("")
    const [isAbsence, setIsAbsence] = useState(false)

    useEffect(() => {
        async function fetchAndDisplay() {
            try {
                const today = new Date()
                const todayStr = today.toISOString().split("T")[0]
                const dayOfWeek = today.getDay()

                // 1. Prüfe Abwesenheit (hat Vorrang)
                const absenceRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/practitioner_absences?select=start_date,end_date,reason,public_message,practitioner_id,practitioner:practitioners!inner(last_name)&start_date=lte.${todayStr}&end_date=gte.${todayStr}&practitioner.last_name=eq.Ercan`,
                    {
                        headers: {
                            apikey: SUPABASE_ANON_KEY,
                            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                        },
                    }
                )

                if (absenceRes.ok) {
                    const absences = await absenceRes.json()
                    if (absences.length > 0) {
                        const absence = absences[0]
                        const endDate = new Date(absence.end_date + "T00:00:00")
                        const formattedEnd = endDate.toLocaleDateString("de-DE", {
                            day: "numeric",
                            month: "long",
                        })
                        setIsAbsence(true)
                        setTitle("Abwesenheit")
                        setText(
                            absence.public_message ||
                                `Dr. med. Yilmaz Ercan ist bis ${formattedEnd} nicht in der Praxis.`
                        )
                        setVisible(true)
                        return
                    }
                }

                // 2. Prüfe OP-Tag Schedules
                const schedRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/practitioner_schedules?select=label,start_time,end_time,practitioner_id,practitioner:practitioners!inner(last_name)&day_of_week=eq.${dayOfWeek}&is_bookable=eq.false&label=like.*OP*&practitioner.last_name=eq.Ercan&valid_from=lte.${todayStr}&or=(valid_until.is.null,valid_until.gte.${todayStr})`,
                    {
                        headers: {
                            apikey: SUPABASE_ANON_KEY,
                            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                        },
                    }
                )

                if (!schedRes.ok) return
                const schedules = await schedRes.json()
                if (schedules.length === 0) return

                if (dayOfWeek === 1) {
                    setTitle(MESSAGES.monday.title)
                    setText(MESSAGES.monday.text)
                    setVisible(true)
                } else if (dayOfWeek === 3) {
                    setTitle(MESSAGES.wednesday.title)
                    setText(MESSAGES.wednesday.text)
                    setVisible(true)
                } else {
                    const sched = schedules[0]
                    setTitle("Hinweis")
                    setText(`Dr. med. Yilmaz Ercan: ${sched.label}`)
                    setVisible(true)
                }
            } catch (err) {
                console.error("[OP-Tag Hinweis]", err)
            }
        }

        fetchAndDisplay()
    }, [])

    if (!visible) return null

    const containerStyle: React.CSSProperties = {
        maxWidth: 680,
        margin: "1.5rem auto",
        padding: "1rem 1.25rem",
        borderRadius: 10,
        borderLeft: `4px solid ${isAbsence ? "#2674BB" : "#D97706"}`,
        background: isAbsence ? "#EFF6FF" : "#FFFBEB",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
    }

    const titleColor = isAbsence ? "#1E40AF" : "#92400E"
    const textColor = isAbsence ? "#1E3A5F" : "#78350F"
    const iconColor = isAbsence ? "#2674BB" : "#D97706"

    return (
        <div style={containerStyle}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={iconColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                </svg>
            </div>
            <div style={{ flex: 1 }}>
                <p
                    style={{
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        color: titleColor,
                        margin: "0 0 0.25rem 0",
                    }}
                >
                    {title}
                </p>
                <p
                    style={{
                        fontSize: "0.875rem",
                        color: textColor,
                        lineHeight: 1.5,
                        margin: 0,
                    }}
                >
                    {text}
                </p>
            </div>
        </div>
    )
}
