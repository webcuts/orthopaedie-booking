import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// =====================================================
// Chatbot Component für Orthopädische Klinik Königstrasse
// Framer Code Component — Standalone
// =====================================================

const BOOKING_URL = "https://same-prism-253693.framer.app/buchen"

interface Message {
    id: number
    text: string
    isBot: boolean
    timestamp: Date
}

interface QuickReply {
    id: string
    text: string
    response: string
}

// --- Quick Replies ---
const quickReplies: QuickReply[] = [
    {
        id: "hours",
        text: "Öffnungszeiten",
        response:
            "Unsere Sprechzeiten:\n\nMo, Di, Do: 07:45 - 12:30 Uhr & 13:00 - 17:30 Uhr\nMittwoch: 07:30 - 12:30 Uhr\nFreitag: 07:45 - 12:30 Uhr & 13:00 - 16:30 Uhr\n\nTelefonisch erreichen Sie uns unter:\n0511 34833-0",
    },
    {
        id: "address",
        text: "Adresse & Anfahrt",
        response:
            "Sie finden uns hier:\n\nOrthopädische Klinik Königstrasse\nBerliner Allee 14\n30175 Hannover\n\nHinweis: Es sind leider keine eigenen Parkplätze vorhanden. Bitte nutzen Sie die öffentlichen Parkmöglichkeiten in der Umgebung.",
    },
    {
        id: "treatments",
        text: "Behandlungen",
        response:
            "Wir bieten ein umfassendes Leistungsspektrum in der Orthopädie und Unfallchirurgie an.\n\nDazu gehören u.a.:\n• Schmerztherapie\n• Gelenkersatz (Knie, Hüfte, Schulter)\n• Arthroskopische Operationen\n• Handchirurgie\n• Spezielle Fußchirurgie\n• Akupunktur & Stoßwellentherapie\n\nDetaillierte Informationen finden Sie auf unserer Website unter 'Leistungen'.",
    },
    {
        id: "appointment",
        text: "Termin vereinbaren",
        response: `Sie können Ihren Termin direkt hier auf unserer Website buchen:\n\nKlicken Sie auf den folgenden Link, um zur Online-Terminbuchung zu gelangen:\n\n${BOOKING_URL}\n\nAlternativ erreichen Sie uns telefonisch:\n0511 34833-0\n\nOffene Sprechstunde:\nMo, Di, Do: 07:45-12:30 Uhr (nach Kapazität, idealerweise mit Überweisung)\nMi: 07:30-12:30 Uhr\nFr: 07:45-12:30 Uhr\n\nPrivatpatienten: Termine nach Vereinbarung.`,
    },
    {
        id: "insurance",
        text: "Versicherung",
        response:
            "Wir behandeln sowohl gesetzlich als auch privat versicherte Patienten. Für gesetzlich Versicherte bitten wir Sie, wenn möglich eine Überweisung mitzubringen. Privatpatienten können direkt einen Termin vereinbaren. Bei Fragen zu Ihrer Versicherung erreichen Sie uns unter 0511 34833-0.",
    },
    {
        id: "emergency",
        text: "Notfall",
        response:
            "Bei einem akuten Notfall wählen Sie bitte den Notruf 112. In unserer offenen Sprechstunde (Mo, Di, Do: 07:45-12:30 Uhr, Mi: 07:30-12:30 Uhr, Fr: 07:45-12:30 Uhr) behandeln wir auch akute Beschwerden nach Kapazität. Außerhalb der Sprechzeiten wenden Sie sich bitte an die nächste Notaufnahme.",
    },
    {
        id: "contact",
        text: "Kontakt",
        response:
            "Sie erreichen uns wie folgt:\n\nTelefon: 0511 34833-0\nAdresse: Berliner Allee 14, 30175 Hannover\n\nTelefonische Erreichbarkeit:\nMo, Di, Do: 07:45-12:30 & 13:00-17:30 Uhr\nMittwoch: 07:30-12:30 Uhr\nFreitag: 07:45-12:30 & 13:00-16:30 Uhr",
    },
]

// --- Keyword Matching ---
const keywordMap: { keywords: string[]; responseId: string }[] = [
    {
        keywords: [
            "öffnungszeit",
            "sprechzeit",
            "sprechstunde",
            "geöffnet",
            "offen",
            "wann",
            "uhrzeit",
        ],
        responseId: "hours",
    },
    {
        keywords: [
            "adresse",
            "anfahrt",
            "wo",
            "parken",
            "parkplatz",
            "route",
            "finden",
            "standort",
            "karte",
        ],
        responseId: "address",
    },
    {
        keywords: [
            "behandlung",
            "leistung",
            "operation",
            "op",
            "arthroskopie",
            "knie",
            "hüfte",
            "schulter",
            "hand",
            "fuß",
            "schmerz",
            "akupunktur",
            "stoßwelle",
            "therapie",
            "chirurgie",
        ],
        responseId: "treatments",
    },
    {
        keywords: [
            "termin",
            "buchen",
            "buchung",
            "vereinbaren",
            "anmelden",
            "online",
        ],
        responseId: "appointment",
    },
    {
        keywords: [
            "versicherung",
            "kasse",
            "privat",
            "gesetzlich",
            "aok",
            "tk",
            "barmer",
            "dak",
            "ikk",
            "überweisung",
        ],
        responseId: "insurance",
    },
    {
        keywords: [
            "notfall",
            "notaufnahme",
            "unfall",
            "akut",
            "dringend",
            "sofort",
        ],
        responseId: "emergency",
    },
    {
        keywords: [
            "telefon",
            "anrufen",
            "kontakt",
            "mail",
            "email",
            "fax",
            "erreichbar",
        ],
        responseId: "contact",
    },
]

const FALLBACK_RESPONSE =
    "Leider konnte ich Ihre Frage nicht zuordnen. Bitte versuchen Sie es mit einem anderen Stichwort oder nutzen Sie die Schnellantworten oben. Sie können uns auch direkt anrufen unter 0511 34833-0."

function matchKeyword(input: string): string | null {
    const lower = input.toLowerCase()
    for (const entry of keywordMap) {
        if (entry.keywords.some((kw) => lower.includes(kw))) {
            return entry.responseId
        }
    }
    return null
}

function formatBotMessage(text: string): string {
    return text
        .replace(
            /(\d{4}\s?\d{5}-\d)/g,
            '<a href="tel:$1" style="color: #2674bb; text-decoration: underline; font-weight: 600;">$1</a>'
        )
        .replace(
            /(https:\/\/same-prism-253693\.framer\.app\/buchen)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2674bb; text-decoration: underline; font-weight: 600;">Online-Terminbuchung</a>'
        )
}

// =====================================================
// Component
// =====================================================

export default function ChatbotComponent() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [hasShownWelcome, setHasShownWelcome] = useState(false)
    const [inputText, setInputText] = useState("")
    const [quickRepliesCollapsed, setQuickRepliesCollapsed] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        if (isOpen && !hasShownWelcome) {
            setTimeout(() => {
                addBotMessage(
                    "Willkommen in der Orthopädischen Klinik Königstrasse! Wie kann ich Ihnen helfen?"
                )
                setHasShownWelcome(true)
            }, 500)
        }
    }, [isOpen, hasShownWelcome])

    const addBotMessage = (text: string) => {
        const newMessage: Message = {
            id: Date.now(),
            text,
            isBot: true,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, newMessage])
    }

    const addUserMessage = (text: string) => {
        const newMessage: Message = {
            id: Date.now(),
            text,
            isBot: false,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, newMessage])
    }

    const handleQuickReply = (reply: QuickReply) => {
        addUserMessage(reply.text)
        setQuickRepliesCollapsed(true)
        setTimeout(() => {
            addBotMessage(reply.response)
        }, 600)
    }

    const handleTextSubmit = () => {
        const text = inputText.trim()
        if (!text) return
        addUserMessage(text)
        setInputText("")
        const matchedId = matchKeyword(text)
        const response = matchedId
            ? quickReplies.find((qr) => qr.id === matchedId)?.response ||
              FALLBACK_RESPONSE
            : FALLBACK_RESPONSE
        setTimeout(() => addBotMessage(response), 600)
    }

    const toggleChat = () => {
        setIsOpen(!isOpen)
    }

    return (
        <div
            style={{
                position: "fixed",
                bottom: "20px",
                left: "20px",
                zIndex: 9999,
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
            }}
        >
            <style>{`
                .chatbot-messages::-webkit-scrollbar {
                    width: 6px;
                }
                .chatbot-messages::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chatbot-messages::-webkit-scrollbar-thumb {
                    background: #cbd5e0;
                    border-radius: 3px;
                }
                .chatbot-messages::-webkit-scrollbar-thumb:hover {
                    background: #a0aec0;
                }
                .chatbot-quick-replies::-webkit-scrollbar {
                    width: 4px;
                }
                .chatbot-quick-replies::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chatbot-quick-replies::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 2px;
                }
            `}</style>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: "absolute",
                            bottom: "80px",
                            left: "0",
                            width: "380px",
                            maxWidth: "calc(100vw - 40px)",
                            height: "600px",
                            maxHeight: "calc(100vh - 120px)",
                            backgroundColor: "white",
                            borderRadius: "16px",
                            boxShadow:
                                "0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                padding: "20px",
                                background: "#2674bb",
                                color: "white",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: "18px",
                                        fontWeight: "600",
                                    }}
                                >
                                    Chat-Assistent
                                </div>
                                <div
                                    style={{
                                        fontSize: "13px",
                                        opacity: 0.9,
                                        marginTop: "4px",
                                    }}
                                >
                                    Orthopädische Klinik Königstrasse
                                </div>
                            </div>
                            <button
                                onClick={toggleChat}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "white",
                                    fontSize: "24px",
                                    cursor: "pointer",
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Messages */}
                        <div
                            className="chatbot-messages"
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                overflowX: "hidden",
                                padding: "20px",
                                backgroundColor: "#f8f9fa",
                                WebkitOverflowScrolling: "touch",
                            }}
                        >
                            {messages.map((message) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    style={{
                                        marginBottom: "16px",
                                        display: "flex",
                                        justifyContent: message.isBot
                                            ? "flex-start"
                                            : "flex-end",
                                    }}
                                >
                                    <div
                                        style={{
                                            maxWidth: "80%",
                                            padding: "12px 16px",
                                            borderRadius: "12px",
                                            backgroundColor: message.isBot
                                                ? "white"
                                                : "#2674bb",
                                            color: message.isBot
                                                ? "#333"
                                                : "white",
                                            fontSize: "14px",
                                            lineHeight: "1.5",
                                            whiteSpace: "pre-wrap",
                                            boxShadow: message.isBot
                                                ? "0 2px 8px rgba(0,0,0,0.08)"
                                                : "none",
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: message.isBot
                                                ? formatBotMessage(
                                                      message.text
                                                  )
                                                : message.text,
                                        }}
                                    />
                                </motion.div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Replies */}
                        {!quickRepliesCollapsed ? (
                            <div
                                className="chatbot-quick-replies"
                                style={{
                                    padding: "16px 20px",
                                    backgroundColor: "white",
                                    borderTop: "1px solid #e9ecef",
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "8px",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                }}
                            >
                                {quickReplies.map((reply) => (
                                    <button
                                        key={reply.id}
                                        onClick={() =>
                                            handleQuickReply(reply)
                                        }
                                        style={{
                                            padding: "10px 14px",
                                            border: "1px solid #2674bb",
                                            borderRadius: "8px",
                                            backgroundColor: "white",
                                            color: "#2674bb",
                                            fontSize: "13px",
                                            fontWeight: "500",
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                            textAlign: "center",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                                "#2674bb"
                                            e.currentTarget.style.color =
                                                "white"
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                                "white"
                                            e.currentTarget.style.color =
                                                "#2674bb"
                                        }}
                                    >
                                        {reply.text}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding: "8px 20px",
                                    backgroundColor: "white",
                                    borderTop: "1px solid #e9ecef",
                                    textAlign: "center",
                                }}
                            >
                                <button
                                    onClick={() =>
                                        setQuickRepliesCollapsed(false)
                                    }
                                    style={{
                                        padding: "6px 16px",
                                        border: "1px solid #dee2e6",
                                        borderRadius: "16px",
                                        backgroundColor: "white",
                                        color: "#6c757d",
                                        fontSize: "12px",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor =
                                            "#f8f9fa"
                                        e.currentTarget.style.color = "#333"
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor =
                                            "white"
                                        e.currentTarget.style.color = "#6c757d"
                                    }}
                                >
                                    Mehr Fragen
                                </button>
                            </div>
                        )}

                        {/* Text Input */}
                        <div
                            style={{
                                padding: "12px 20px",
                                backgroundColor: "white",
                                borderTop: "1px solid #e9ecef",
                                display: "flex",
                                gap: "8px",
                            }}
                        >
                            <input
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && handleTextSubmit()
                                }
                                placeholder="Ihre Frage eingeben..."
                                style={{
                                    flex: 1,
                                    padding: "10px 14px",
                                    border: "1px solid #dee2e6",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    outline: "none",
                                    fontFamily: "inherit",
                                }}
                            />
                            <button
                                onClick={handleTextSubmit}
                                style={{
                                    padding: "10px 16px",
                                    backgroundColor: "#2674bb",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    transition: "background-color 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        "#1e5fa0"
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        "#2674bb"
                                }}
                            >
                                Senden
                            </button>
                        </div>

                        {/* Footer Info */}
                        <div
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "#f8f9fa",
                                borderTop: "1px solid #e9ecef",
                                fontSize: "12px",
                                color: "#6c757d",
                                textAlign: "center",
                            }}
                        >
                            Oder rufen Sie uns an:{" "}
                            <a
                                href="tel:051134833-0"
                                style={{
                                    color: "#2674bb",
                                    textDecoration: "none",
                                    fontWeight: "600",
                                }}
                            >
                                0511 34833-0
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    backgroundColor: "#2674bb",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow:
                        "0 4px 16px rgba(38, 116, 187, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1)",
                    color: "white",
                    fontSize: "28px",
                    transition: "all 0.3s",
                }}
            >
                {isOpen ? "×" : "💬"}
            </motion.button>
        </div>
    )
}
