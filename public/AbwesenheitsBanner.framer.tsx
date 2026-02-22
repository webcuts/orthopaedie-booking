// Abwesenheits-Banner — Framer Code Component
// Diesen Code in Framer unter Assets → Code → neue Datei einfügen

import { useEffect, useState } from "react"

const SUPABASE_URL = "https://jgammhrdgoxxbcwvlqcd.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_Ww1hByyP9FrP4mCoj7-Uvg_tDPmW1Hg"

const REASON_MAP: Record<string, string> = {
    vacation: "Urlaub",
    sick: "Erkrankung",
    other: "Abwesenheit",
}

interface Practitioner {
    title: string | null
    first_name: string
    last_name: string
}

interface Absence {
    id: string
    start_date: string
    end_date: string
    reason: string
    public_message: string | null
    practitioner: Practitioner | null
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

function formatDateShort(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
}

function practitionerName(p: Practitioner | null) {
    if (!p) return "Behandler"
    return ((p.title || "") + " " + p.first_name + " " + p.last_name).trim()
}

function generateText(absence: Absence) {
    if (absence.public_message) return absence.public_message
    const name = practitionerName(absence.practitioner)
    const reason = REASON_MAP[absence.reason] || "Abwesenheit"
    const startYear = absence.start_date.substring(0, 4)
    const endYear = absence.end_date.substring(0, 4)
    const start =
        startYear === endYear
            ? formatDateShort(absence.start_date)
            : formatDate(absence.start_date)
    const end = formatDate(absence.end_date)
    return (
        name +
        " ist vom " +
        start +
        " bis " +
        end +
        " nicht verfügbar (" +
        reason +
        ")."
    )
}

export default function AbwesenheitsBanner() {
    const [absences, setAbsences] = useState<Absence[]>([])
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0]
        const in7Days = new Date(Date.now() + 7 * 86400000)
            .toISOString()
            .split("T")[0]

        const url =
            SUPABASE_URL +
            "/rest/v1/practitioner_absences" +
            "?select=*,practitioner:practitioners(title,first_name,last_name)" +
            "&show_on_website=eq.true" +
            "&end_date=gte." +
            today +
            "&start_date=lte." +
            in7Days +
            "&order=start_date"

        fetch(url, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: "Bearer " + SUPABASE_ANON_KEY,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setAbsences(data)
                }
            })
            .catch((err) =>
                console.warn("[absence-banner] Fehler:", err)
            )
    }, [])

    const handleClose = () => {
        setDismissed(true)
    }

    if (dismissed || absences.length === 0) return null

    return (
        <div
            style={{
                position: "relative",
                background: "#FEF3C7",
                borderBottom: "2px solid #F59E0B",
                padding: "12px 48px 12px 20px",
                fontFamily: "Arial, sans-serif",
                fontSize: 14,
                color: "#92400E",
                lineHeight: 1.5,
                width: "100%",
            }}
        >
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                {absences.map((absence, i) => (
                    <p
                        key={absence.id}
                        style={{
                            margin: 0,
                            marginTop: i > 0 ? 6 : 0,
                        }}
                    >
                        {generateText(absence)}
                    </p>
                ))}
            </div>
            <button
                onClick={handleClose}
                aria-label="Banner schließen"
                style={{
                    position: "absolute",
                    top: 8,
                    right: 12,
                    background: "none",
                    border: "none",
                    fontSize: 22,
                    color: "#92400E",
                    cursor: "pointer",
                    padding: "4px 8px",
                    lineHeight: 1,
                    opacity: 0.7,
                }}
                onMouseOver={(e) =>
                    (e.currentTarget.style.opacity = "1")
                }
                onMouseOut={(e) =>
                    (e.currentTarget.style.opacity = "0.7")
                }
            >
                ×
            </button>
        </div>
    )
}
