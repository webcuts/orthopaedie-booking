// Karriere Pop-up — Framer Code Component
// Diesen Code in Framer unter Assets → Code → neue Datei einfügen
// Component auf jeder Seite platzieren (unsichtbar, rendert Modal als Overlay)

import { useEffect, useState } from "react"

const STORAGE_KEY = "ortho_karriere_popup_closed"
const DELAY_MS = 2500
const HIDE_DAYS = 7

export default function KarrierePopup() {
    const [visible, setVisible] = useState(false)
    const [animating, setAnimating] = useState(false)

    useEffect(() => {
        const closedAt = localStorage.getItem(STORAGE_KEY)
        if (closedAt) {
            const diff = Date.now() - parseInt(closedAt, 10)
            if (diff < HIDE_DAYS * 86400000) return
        }

        const timer = setTimeout(() => {
            setVisible(true)
            requestAnimationFrame(() => setAnimating(true))
        }, DELAY_MS)

        return () => clearTimeout(timer)
    }, [])

    const handleClose = () => {
        setAnimating(false)
        localStorage.setItem(STORAGE_KEY, String(Date.now()))
        setTimeout(() => setVisible(false), 300)
    }

    if (!visible) return null

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose()
            }}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,0.5)",
                zIndex: 999999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                opacity: animating ? 1 : 0,
                transition: "opacity 0.3s ease",
            }}
        >
            <div
                style={{
                    background: "#FFFFFF",
                    borderRadius: 12,
                    padding: "36px 32px 28px",
                    maxWidth: 500,
                    width: "100%",
                    position: "relative",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                    transform: animating
                        ? "translateY(0)"
                        : "translateY(20px)",
                    transition: "transform 0.3s ease",
                }}
            >
                {/* Close */}
                <button
                    onClick={handleClose}
                    aria-label="Schließen"
                    style={{
                        position: "absolute",
                        top: 12,
                        right: 16,
                        background: "none",
                        border: "none",
                        fontSize: 24,
                        color: "#9CA3AF",
                        cursor: "pointer",
                        padding: "4px 8px",
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>

                {/* Icon */}
                <div
                    style={{
                        width: 48,
                        height: 48,
                        background: "#EBF5FF",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 20,
                        fontSize: 24,
                    }}
                >
                    🩺
                </div>

                {/* Heading */}
                <h2
                    style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: 22,
                        fontWeight: 700,
                        color: "#1F2937",
                        margin: "0 0 12px 0",
                        lineHeight: 1.3,
                    }}
                >
                    Wir suchen Verstärkung!
                </h2>

                {/* Text */}
                <p
                    style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: 15,
                        color: "#4B5563",
                        lineHeight: 1.6,
                        margin: "0 0 24px 0",
                    }}
                >
                    Die Orthopädie Königstraße sucht ab sofort
                    engagierte Medizinische Fachangestellte (MFA)
                    sowie Fachärzte für Orthopädie und
                    Unfallchirurgie. Werden Sie Teil unseres Teams
                    in Hannover.
                </p>

                {/* Buttons */}
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <a
                        href="mailto:bewerbung@orthopaedie-koenigstrasse.de?subject=Bewerbung"
                        style={{
                            display: "inline-block",
                            padding: "12px 24px",
                            background: "#2674BB",
                            color: "#FFFFFF",
                            borderRadius: 8,
                            fontFamily: "Arial, sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            textDecoration: "none",
                            textAlign: "center",
                            flex: 1,
                            minWidth: 140,
                        }}
                    >
                        Jetzt bewerben
                    </a>
                    <a
                        href="/karriere"
                        style={{
                            display: "inline-block",
                            padding: "12px 24px",
                            background: "#F3F4F6",
                            color: "#374151",
                            borderRadius: 8,
                            fontFamily: "Arial, sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            textDecoration: "none",
                            textAlign: "center",
                            flex: 1,
                            minWidth: 140,
                        }}
                    >
                        Mehr erfahren
                    </a>
                </div>
            </div>
        </div>
    )
}
