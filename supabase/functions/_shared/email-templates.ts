// ORTHO-007: E-Mail Templates
// Shared email templates for booking system

export interface AppointmentData {
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  date: string;
  time: string;
  endTime: string;
  treatmentType: string;
  practitionerName: string | null;
  specialtyName?: string;
  insuranceType?: string;
  cancellationDeadline?: string;
}

// Praxis-Informationen
const PRACTICE_INFO = {
  name: 'Orthopädie Königstraße',
  address: 'Königstraße 51',
  city: '30175 Hannover',
  phone: '0511 123456',
  email: 'praxis@orthopaedie-koenigstrasse.de',
  website: 'https://orthopaedie-koenigstrasse.de',
};

// E-Mail Styles (inline für bessere Kompatibilität)
const styles = {
  body: 'margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;',
  container: 'max-width: 600px; margin: 0 auto; background-color: #ffffff;',
  header: 'background-color: #2674BB; padding: 24px; text-align: center;',
  headerTitle: 'color: #ffffff; font-size: 24px; font-weight: bold; margin: 0;',
  headerSubtitle: 'color: #ffffff; font-size: 14px; margin: 8px 0 0 0; opacity: 0.9;',
  content: 'padding: 32px 24px;',
  greeting: 'font-size: 18px; color: #000000; margin: 0 0 16px 0;',
  text: 'font-size: 14px; color: #000000; line-height: 1.6; margin: 0 0 16px 0;',
  detailsBox: 'background-color: #F0F7FB; border: 1px solid #E5E5E5; border-radius: 8px; padding: 20px; margin: 24px 0;',
  detailsTitle: 'font-size: 16px; font-weight: bold; color: #2674BB; margin: 0 0 16px 0;',
  detailRow: 'display: flex; margin-bottom: 8px; font-size: 14px;',
  detailLabel: 'color: #6B7280; width: 120px; flex-shrink: 0;',
  detailValue: 'color: #000000; font-weight: 500;',
  addressBox: 'background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;',
  addressTitle: 'font-size: 14px; font-weight: bold; color: #374151; margin: 0 0 8px 0;',
  addressText: 'font-size: 14px; color: #6B7280; margin: 0; line-height: 1.5;',
  hint: 'background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400E;',
  footer: 'background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #E5E5E5;',
  footerText: 'font-size: 12px; color: #6B7280; margin: 0 0 8px 0;',
  footerLink: 'color: #2674BB; text-decoration: none;',
};

// Hilfsfunktion für Datum formatieren
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Hilfsfunktion für Uhrzeit formatieren
function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5) + ' Uhr';
}

/**
 * Buchungsbestätigung für Patienten
 */
export function generateBookingConfirmationEmail(data: AppointmentData): string {
  const practitioner = data.practitionerName || 'Nächster verfügbarer Behandler';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminbestätigung</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <!-- Header -->
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">${PRACTICE_INFO.name}</h1>
      <p style="${styles.headerSubtitle}">Terminbestätigung</p>
    </div>

    <!-- Content -->
    <div style="${styles.content}">
      <p style="${styles.greeting}">Guten Tag ${data.patientName},</p>

      <p style="${styles.text}">
        vielen Dank für Ihre Terminbuchung. Ihr Termin wurde erfolgreich registriert.
      </p>

      <!-- Termindetails -->
      <div style="${styles.detailsBox}">
        <h2 style="${styles.detailsTitle}">Ihre Termindetails</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 120px;">Datum:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatDate(data.date)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Uhrzeit:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatTime(data.time)} - ${formatTime(data.endTime)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Terminart:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.treatmentType}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Behandler:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${practitioner}</td>
          </tr>
          ${data.specialtyName ? `
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Fachgebiet:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.specialtyName}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Praxisadresse -->
      <div style="${styles.addressBox}">
        <h3 style="${styles.addressTitle}">Praxisadresse</h3>
        <p style="${styles.addressText}">
          ${PRACTICE_INFO.name}<br>
          ${PRACTICE_INFO.address}<br>
          ${PRACTICE_INFO.city}<br>
          Tel: ${PRACTICE_INFO.phone}
        </p>
      </div>

      <!-- Hinweise -->
      <div style="${styles.hint}">
        <strong>Bitte beachten Sie:</strong><br>
        Eine kostenfreie Stornierung ist bis 12 Stunden vor dem Termin möglich.
        Sie erhalten 24 Stunden und 6 Stunden vor Ihrem Termin eine Erinnerung per E-Mail.
      </div>

      <p style="${styles.text}">
        Bei Fragen erreichen Sie uns telefonisch unter ${PRACTICE_INFO.phone} oder per E-Mail an
        <a href="mailto:${PRACTICE_INFO.email}" style="color: #2674BB;">${PRACTICE_INFO.email}</a>.
      </p>

      <p style="${styles.text}">
        Wir freuen uns auf Ihren Besuch!
      </p>

      <p style="${styles.text}">
        Mit freundlichen Grüßen<br>
        <strong>Ihr Praxisteam</strong><br>
        ${PRACTICE_INFO.name}
      </p>
    </div>

    <!-- Footer -->
    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        ${PRACTICE_INFO.name} | ${PRACTICE_INFO.address} | ${PRACTICE_INFO.city}
      </p>
      <p style="${styles.footerText}">
        <a href="${PRACTICE_INFO.website}" style="${styles.footerLink}">${PRACTICE_INFO.website}</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Benachrichtigung für die Praxis
 */
export function generatePracticeNotificationEmail(data: AppointmentData): string {
  const practitioner = data.practitionerName || 'Keine Präferenz';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neue Terminbuchung</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <!-- Header -->
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">Neue Terminbuchung</h1>
      <p style="${styles.headerSubtitle}">${PRACTICE_INFO.name}</p>
    </div>

    <!-- Content -->
    <div style="${styles.content}">
      <p style="${styles.text}">
        Ein neuer Termin wurde über das Online-Buchungssystem gebucht.
      </p>

      <!-- Patientendaten -->
      <div style="${styles.detailsBox}">
        <h2 style="${styles.detailsTitle}">Patientendaten</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 120px;">Name:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.patientName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">E-Mail:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">
              <a href="mailto:${data.patientEmail}" style="color: #2674BB;">${data.patientEmail}</a>
            </td>
          </tr>
          ${data.patientPhone ? `
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Telefon:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">
              <a href="tel:${data.patientPhone}" style="color: #2674BB;">${data.patientPhone}</a>
            </td>
          </tr>
          ` : ''}
          ${data.insuranceType ? `
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Versicherung:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.insuranceType}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Termindetails -->
      <div style="${styles.detailsBox}">
        <h2 style="${styles.detailsTitle}">Termindetails</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 120px;">Datum:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatDate(data.date)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Uhrzeit:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatTime(data.time)} - ${formatTime(data.endTime)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Terminart:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.treatmentType}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Behandler:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${practitioner}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        Diese E-Mail wurde automatisch vom Buchungssystem generiert.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Erinnerungs-E-Mail (24h oder 6h vor Termin)
 */
export function generateReminderEmail(data: AppointmentData, reminderType: '24h_before' | '6h_before'): string {
  const practitioner = data.practitionerName || 'Nächster verfügbarer Behandler';
  const isToday = reminderType === '6h_before';
  const title = isToday ? 'Ihr Termin heute' : 'Ihr Termin morgen';
  const intro = isToday
    ? 'Wir möchten Sie an Ihren heutigen Termin erinnern.'
    : 'Wir möchten Sie an Ihren morgigen Termin erinnern.';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminerinnerung</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <!-- Header -->
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">${PRACTICE_INFO.name}</h1>
      <p style="${styles.headerSubtitle}">Terminerinnerung</p>
    </div>

    <!-- Content -->
    <div style="${styles.content}">
      <p style="${styles.greeting}">Guten Tag ${data.patientName},</p>

      <p style="${styles.text}">${intro}</p>

      <!-- Termindetails -->
      <div style="${styles.detailsBox}">
        <h2 style="${styles.detailsTitle}">${title}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 120px;">Datum:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatDate(data.date)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Uhrzeit:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatTime(data.time)} - ${formatTime(data.endTime)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Terminart:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.treatmentType}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Behandler:</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${practitioner}</td>
          </tr>
        </table>
      </div>

      <!-- Praxisadresse -->
      <div style="${styles.addressBox}">
        <h3 style="${styles.addressTitle}">Praxisadresse</h3>
        <p style="${styles.addressText}">
          ${PRACTICE_INFO.name}<br>
          ${PRACTICE_INFO.address}<br>
          ${PRACTICE_INFO.city}<br>
          Tel: ${PRACTICE_INFO.phone}
        </p>
      </div>

      ${!isToday && data.cancellationDeadline ? `
      <div style="${styles.hint}">
        <strong>Hinweis:</strong> Eine kostenfreie Stornierung ist noch bis ${data.cancellationDeadline} möglich.
      </div>
      ` : ''}

      <p style="${styles.text}">
        Bei Fragen erreichen Sie uns telefonisch unter ${PRACTICE_INFO.phone}.
      </p>

      <p style="${styles.text}">
        Wir freuen uns auf Ihren Besuch!
      </p>

      <p style="${styles.text}">
        Mit freundlichen Grüßen<br>
        <strong>Ihr Praxisteam</strong><br>
        ${PRACTICE_INFO.name}
      </p>
    </div>

    <!-- Footer -->
    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        ${PRACTICE_INFO.name} | ${PRACTICE_INFO.address} | ${PRACTICE_INFO.city}
      </p>
      <p style="${styles.footerText}">
        <a href="${PRACTICE_INFO.website}" style="${styles.footerLink}">${PRACTICE_INFO.website}</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}
