// Offene Samstage — Banner zur Hervorhebung freier Sa-Termine
// Passt visuell zum Doctolib_banner (gleiche Proportionen), aber positive Signalfarbe
// Spiegelkopie des Framer-Code-Components (codeFileId: JTqYy3f), für Git-Tracking.
import { addPropertyControls, ControlType } from "framer"

// Sa-Daten als ISO-Strings (YYYY-MM-DD). Vergangene werden automatisch ausgeblendet.
const SAMSTAGE: { iso: string; label: string }[] = [
    { iso: "2026-05-30", label: "Sa, 30.05." },
    { iso: "2026-06-13", label: "Sa, 13.06." },
    { iso: "2026-06-27", label: "Sa, 27.06." },
]

export default function OffeneSamstage({
    borderRadius = 23,
}: {
    borderRadius?: number
}) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming = SAMSTAGE.filter((s) => {
        const d = new Date(s.iso + "T00:00:00")
        return d >= today
    })

    if (upcoming.length === 0) return null

    return (
        <div
            style={{
                background:
                    "linear-gradient(135deg, #0F9D58 0%, #0B7E47 100%)",
                color: "#ffffff",
                padding: "1.5rem 2rem",
                textAlign: "center",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxShadow: "0 4px 16px rgba(15, 157, 88, 0.30)",
                width: "100%",
                borderRadius,
                border: "2px solid #0B7E47",
            }}
        >
            <div
                style={{
                    maxWidth: 700,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 800,
                        fontSize: "1.25rem",
                        letterSpacing: "-0.01em",
                    }}
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Offene Samstage
                </div>

                <p
                    style={{
                        fontSize: "1.05rem",
                        lineHeight: 1.55,
                        margin: 0,
                        fontWeight: 600,
                        opacity: 0.95,
                    }}
                >
                    An folgenden Samstagen sind zusätzliche Termine bei
                    Dr. Jonda und Dr. Flores online buchbar:
                </p>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: "0.5rem",
                    }}
                >
                    {upcoming.map((s) => (
                        <span
                            key={s.iso}
                            style={{
                                background: "rgba(255, 255, 255, 0.18)",
                                border: "1px solid rgba(255, 255, 255, 0.45)",
                                padding: "0.4rem 0.9rem",
                                borderRadius: 999,
                                fontSize: "1rem",
                                fontWeight: 700,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {s.label}
                        </span>
                    ))}
                </div>

                <a
                    href="/buchen"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#ffffff",
                        color: "#0B7E47",
                        fontWeight: 700,
                        fontSize: "1rem",
                        padding: "0.75rem 2rem",
                        borderRadius: 8,
                        textDecoration: "none",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    }}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    Samstagstermin sichern
                </a>
            </div>
        </div>
    )
}

addPropertyControls(OffeneSamstage, {
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 23,
        min: 0,
        max: 32,
        step: 1,
    },
})
