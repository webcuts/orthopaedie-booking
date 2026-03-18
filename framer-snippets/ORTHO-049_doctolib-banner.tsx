// ORTHO-049: Doctolib-Abkündigung Banner
// Einbindung: Framer → Code → New File → Inhalt einfügen
// Platzierung: Ganz oben auf der Startseite, sichtbar ohne Scrollen

export default function DoctolibBanner() {
    return (
        <div
            style={{
                background: "linear-gradient(135deg, #2674BB 0%, #1a5a9a 100%)",
                color: "#ffffff",
                padding: "1.25rem 1.5rem",
                textAlign: "center",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxShadow: "0 2px 8px rgba(38, 116, 187, 0.3)",
                width: "100%",
            }}
        >
            <div
                style={{
                    maxWidth: 800,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.75rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 700,
                        fontSize: "1.05rem",
                    }}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    Wichtige Information
                </div>

                <p style={{ fontSize: "0.95rem", lineHeight: 1.5, opacity: 0.95, margin: 0 }}>
                    Ab sofort buchen Sie Ihren Termin direkt über unsere Website.
                    <br />
                    Buchungen über Doctolib sind nicht mehr möglich.
                </p>

                <a
                    href="https://orthopaedie-booking.vercel.app"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#ffffff",
                        color: "#2674BB",
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        padding: "0.625rem 1.5rem",
                        borderRadius: 8,
                        textDecoration: "none",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                    }}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Jetzt Termin buchen
                </a>
            </div>
        </div>
    )
}
