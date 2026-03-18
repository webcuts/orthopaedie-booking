// ORTHO-048: Telefonische Erreichbarkeit
// Einbindung: Framer → Code → New File → Inhalt einfügen
// Platzierung: Kontaktseite und/oder Startseite

// === KONFIGURATION ===
const PHONE_NUMBER = "+495111234567" // Echte Praxisnummer hier eintragen
const PHONE_DISPLAY = "0511 123 4567" // Angezeigte Nummer

const HOURS = [
    { days: "Mo, Di, Do, Fr", hours: "8:00 – 12:00 und 14:00 – 16:00" },
    { days: "Mittwoch", hours: "8:00 – 12:00" },
]
// === ENDE KONFIGURATION ===

const PhoneIcon = ({ size = 18, color = "#2674BB", strokeWidth = 2 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
)

export default function TelefonErreichbarkeit() {
    return (
        <div
            style={{
                maxWidth: 400,
                margin: "1.5rem auto",
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: "1.25rem 1.5rem",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    marginBottom: "1rem",
                }}
            >
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <PhoneIcon />
                </div>
                <h3
                    style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "#1f2937",
                        margin: 0,
                    }}
                >
                    Telefonische Erreichbarkeit
                </h3>
            </div>

            {/* Zeiten */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                    marginBottom: "1rem",
                }}
            >
                {HOURS.map((row, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.875rem",
                            padding: "0.375rem 0",
                            borderBottom:
                                i < HOURS.length - 1
                                    ? "1px solid #F3F4F6"
                                    : "none",
                        }}
                    >
                        <span style={{ color: "#374151", fontWeight: 500 }}>
                            {row.days}
                        </span>
                        <span style={{ color: "#6b7280" }}>{row.hours}</span>
                    </div>
                ))}
            </div>

            {/* Telefon-Button */}
            <a
                href={`tel:${PHONE_NUMBER}`}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    background: "#2674BB",
                    color: "white",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "1rem",
                }}
            >
                <PhoneIcon size={16} color="currentColor" strokeWidth={2.5} />
                {PHONE_DISPLAY}
            </a>
        </div>
    )
}
