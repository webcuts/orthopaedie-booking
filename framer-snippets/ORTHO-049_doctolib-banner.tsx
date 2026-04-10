// ORTHO-049 / ORTHO-056: Doctolib-Abkündigung Banner
// Einbindung: Framer → Code → New File → Inhalt einfügen
// Platzierung: Mittig auf der Startseite, ÜBER dem "Termin vereinbaren"-Bereich
// ORTHO-056: Signalfarbe (Gelb/Orange), mind. 18px, fett, zentriert

import { addPropertyControls, ControlType } from "framer"

export default function DoctolibBanner({ borderRadius = 12 }: { borderRadius?: number }) {
    return (
        <div
            style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                color: "#78350F",
                padding: "1.5rem 2rem",
                textAlign: "center",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
                border: "2px solid #D97706",
                width: "100%",
                borderRadius,
            }}
        >
            <div
                style={{
                    maxWidth: 800,
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
                        gap: "0.625rem",
                        fontWeight: 800,
                        fontSize: "1.25rem",
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
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Wichtige Information
                </div>

                <p style={{ fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.5, margin: 0 }}>
                    Buchungen über Doctolib sind ab sofort nicht mehr möglich.
                    <br />
                    Bitte vereinbaren Sie Ihre Termine über unsere Website.
                </p>

                <a
                    href="https://orthopaedie-booking.vercel.app"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#78350F",
                        color: "#FEF3C7",
                        fontWeight: 700,
                        fontSize: "1rem",
                        padding: "0.75rem 1.75rem",
                        borderRadius: 8,
                        textDecoration: "none",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
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

addPropertyControls(DoctolibBanner, {
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 12,
        min: 0,
        max: 32,
        step: 1,
    },
})
