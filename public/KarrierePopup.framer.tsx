// Karriere Pop-up — Framer Code Component
// Diesen Code in Framer unter Assets → Code → neue Datei einfügen
// Component auf jeder Seite platzieren (unsichtbar, rendert Modal als Overlay)
// Links, Texte und Verzögerung sind im Framer Canvas konfigurierbar

import { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

const STORAGE_KEY = "ortho_karriere_popup_closed"

interface Props {
    heading: string
    bodyText: string
    applyLabel: string
    applyLink: string
    moreLabel: string
    moreLink: string
    delayMs: number
    hideDays: number
}

export default function KarrierePopup({
    heading = "Wir suchen Verstärkung!",
    bodyText = "Die Orthopädie Königstraße sucht ab sofort engagierte Medizinische Fachangestellte (MFA) sowie Fachärzte für Orthopädie und Unfallchirurgie. Werden Sie Teil unseres Teams in Hannover.",
    applyLabel = "Jetzt bewerben",
    applyLink = "mailto:bewerbung@orthopaedie-koenigstrasse.de?subject=Bewerbung",
    moreLabel = "Mehr erfahren",
    moreLink = "/karriere",
    delayMs = 2500,
    hideDays = 7,
}: Props) {
    const [visible, setVisible] = useState(false)
    const [animating, setAnimating] = useState(false)

    useEffect(() => {
        const closedAt = localStorage.getItem(STORAGE_KEY)
        if (closedAt) {
            const diff = Date.now() - parseInt(closedAt, 10)
            if (diff < hideDays * 86400000) return
        }

        const timer = setTimeout(() => {
            setVisible(true)
            requestAnimationFrame(() => setAnimating(true))
        }, delayMs)

        return () => clearTimeout(timer)
    }, [delayMs, hideDays])

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
                    {heading}
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
                    {bodyText}
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
                        href={applyLink}
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
                        {applyLabel}
                    </a>
                    <a
                        href={moreLink}
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
                        {moreLabel}
                    </a>
                </div>
            </div>
        </div>
    )
}

addPropertyControls(KarrierePopup, {
    heading: {
        type: ControlType.String,
        title: "Überschrift",
        defaultValue: "Wir suchen Verstärkung!",
    },
    bodyText: {
        type: ControlType.String,
        title: "Text",
        defaultValue:
            "Die Orthopädie Königstraße sucht ab sofort engagierte Medizinische Fachangestellte (MFA) sowie Fachärzte für Orthopädie und Unfallchirurgie. Werden Sie Teil unseres Teams in Hannover.",
        displayTextArea: true,
    },
    applyLabel: {
        type: ControlType.String,
        title: "Button 1 Text",
        defaultValue: "Jetzt bewerben",
    },
    applyLink: {
        type: ControlType.String,
        title: "Button 1 Link",
        defaultValue:
            "mailto:bewerbung@orthopaedie-koenigstrasse.de?subject=Bewerbung",
    },
    moreLabel: {
        type: ControlType.String,
        title: "Button 2 Text",
        defaultValue: "Mehr erfahren",
    },
    moreLink: {
        type: ControlType.String,
        title: "Button 2 Link",
        defaultValue: "/karriere",
    },
    delayMs: {
        type: ControlType.Number,
        title: "Verzögerung (ms)",
        defaultValue: 2500,
        min: 0,
        max: 10000,
        step: 500,
    },
    hideDays: {
        type: ControlType.Number,
        title: "Ausblenden (Tage)",
        defaultValue: 7,
        min: 1,
        max: 30,
        step: 1,
    },
})
