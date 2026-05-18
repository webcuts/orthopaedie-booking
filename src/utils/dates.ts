/**
 * Formatiert ein Date-Objekt als YYYY-MM-DD in der LOKALEN Zeitzone.
 *
 * Wichtig: NIEMALS `date.toISOString().split('T')[0]` benutzen — das konvertiert
 * zu UTC. In CEST (UTC+2) wird z.B. Sa 30.05 00:00 lokal zu Fr 29.05 22:00 UTC,
 * was zu Off-by-One-Bugs in Kalender-Anzeigen führt.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
