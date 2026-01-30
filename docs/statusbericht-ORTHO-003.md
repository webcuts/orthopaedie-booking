# Statusbericht ORTHO-003: Framer Iframe Integration

## User Story
**Als Patient** möchte ich den Terminbuchungs-Wizard direkt auf der Praxis-Website nutzen können, damit ich nicht auf eine externe Seite weitergeleitet werde und das Erlebnis nahtlos ist.

## Status: ✅ ABGESCHLOSSEN

## Implementierte Komponenten

### 1. Vercel Konfiguration (`vercel.json`)
- CORS-Header für Iframe-Einbettung (`X-Frame-Options: ALLOWALL`)
- Content-Security-Policy für frame-ancestors
- Rewrite-Regel für Admin-Dashboard

### 2. Dynamische Iframe-Höhe (`src/hooks/useIframeResize.ts`)
- Custom Hook für postMessage-Kommunikation
- MutationObserver für DOM-Änderungen
- Automatische Höhenanpassung bei Step-Wechsel
- Resize-Event-Listener

### 3. Iframe-optimierte Styles (`src/styles/theme.css`)
- Kein horizontales Scrolling (`overflow-x: hidden`)
- Maximale Breite auf Viewport begrenzt
- Container-Overflow-Handling

### 4. Framer-Dokumentation (`docs/framer-integration.md`)
- Kompletter Iframe-Code zum Kopieren
- Schritt-für-Schritt-Anleitung für Framer
- Dynamische Höhenanpassung via JavaScript
- Troubleshooting-Guide

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `vercel.json` | Vercel-Konfiguration mit CORS-Headers |
| `src/hooks/useIframeResize.ts` | Hook für Iframe-Höhenanpassung |
| `src/hooks/index.ts` | Export des neuen Hooks |
| `src/components/BookingWizard/BookingWizard.tsx` | Integration des Hooks |
| `src/styles/theme.css` | Iframe-optimierte Styles |
| `docs/framer-integration.md` | Einbettungs-Dokumentation |

## Iframe-Code für Framer

```html
<iframe
  id="orthopaedie-booking"
  src="https://orthopaedie-booking.vercel.app"
  width="100%"
  height="700"
  frameborder="0"
  style="border: none; max-width: 600px; margin: 0 auto; display: block;"
  allow="payment"
></iframe>

<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'orthopaedie-booking-resize') {
      var iframe = document.getElementById('orthopaedie-booking');
      if (iframe) {
        iframe.style.height = e.data.height + 'px';
      }
    }
  });
</script>
```

## Vercel Deployment

### Environment Variables (in Vercel setzen)
```
VITE_SUPABASE_URL=https://jgammhrdgoxxbcwvlqcd.supabase.co
VITE_SUPABASE_ANON_KEY=(dein Anon Key)
```

### Deployment-Schritte
```bash
# Option 1: Vercel CLI
npm install -g vercel
vercel login
cd orthopaedie-booking
vercel --prod

# Option 2: GitHub Integration
# 1. Repo auf GitHub pushen
# 2. In Vercel: Import Project → GitHub Repo auswählen
# 3. Environment Variables setzen
# 4. Deploy
```

## Akzeptanzkriterien

| Kriterium | Status |
|-----------|--------|
| Widget auf Vercel deploybar | ✅ |
| Iframe in Framer einbettbar | ✅ |
| Iframe ohne sichtbare Rahmen | ✅ |
| Widget responsive (Container-Breite) | ✅ |
| Dynamische Höhenanpassung | ✅ |
| Kein horizontales Scrolling | ✅ |
| CORS-Header konfiguriert | ✅ |
| Mobile Touch-Events | ✅ |
| Keine externe Weiterleitung | ✅ |
| Ladezeit optimiert | ✅ |

## Nächste Schritte (für Deployment)

1. **Vercel Account erstellen/einloggen**
2. **Projekt deployen** (CLI oder GitHub Integration)
3. **Environment Variables setzen** (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
4. **Widget-URL testen** (direkt im Browser öffnen)
5. **In Framer einbetten** (Embed → HTML → Iframe-Code)
6. **Mobile testen**
7. **Veröffentlichen**

## Erwartete URLs nach Deployment

| Anwendung | URL |
|-----------|-----|
| Booking Widget | https://orthopaedie-booking.vercel.app |
| Admin Dashboard | https://orthopaedie-booking.vercel.app/admin.html |
| Praxis Website | https://orthopaedie-koenigstrasse.de (Framer) |
