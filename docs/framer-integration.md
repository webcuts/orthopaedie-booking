# Framer Iframe Integration

## Iframe-Code für Framer

Kopiere diesen Code in ein Framer Embed-Element:

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
  // Dynamische Höhenanpassung
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

## Einrichtung in Framer (Schritt für Schritt)

1. **Framer-Projekt öffnen**
2. **Seite auswählen** (z.B. "Online Termin" oder "Terminbuchung")
3. **Embed-Element hinzufügen**: Klicke auf `+` → `Embed`
4. **HTML als Typ wählen**
5. **Iframe-Code einfügen** (siehe oben)
6. **Größe anpassen**: Container auf gewünschte Breite setzen
7. **Vorschau testen**: Desktop und Mobile prüfen
8. **Veröffentlichen**

## Alternative: Ohne dynamische Höhe

Falls die dynamische Höhenanpassung Probleme macht, nutze eine feste Höhe:

```html
<iframe
  src="https://orthopaedie-booking.vercel.app"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none; max-width: 600px; margin: 0 auto; display: block;"
  allow="payment"
></iframe>
```

## Empfohlene Höhen

| Gerät | Empfohlene Höhe |
|-------|-----------------|
| Desktop | 700px |
| Tablet | 750px |
| Mobile | 800px |

## Troubleshooting

### Widget wird nicht angezeigt
- Prüfe ob die Vercel-URL korrekt ist
- Öffne die Browser-Konsole (F12) und suche nach Fehlern

### CORS-Fehler
- Die vercel.json enthält bereits die korrekten Header
- Bei Problemen: Vercel-Deployment neu auslösen

### Widget zu klein/groß
- Passe die `max-width` im Style an
- Verwende die dynamische Höhenanpassung

### Touch-Events funktionieren nicht
- Stelle sicher, dass `allow="payment"` gesetzt ist
- Teste in einem echten Mobile-Browser, nicht nur im Responsive-Mode

## URLs

| Anwendung | URL |
|-----------|-----|
| Booking Widget | https://orthopaedie-booking.vercel.app |
| Admin Dashboard | https://orthopaedie-booking.vercel.app/admin.html |
