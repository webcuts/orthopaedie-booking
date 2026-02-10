// ORTHO-007: E-Mail Templates (mehrsprachig)
// Shared email templates for booking system

export type EmailLanguage = 'de' | 'en' | 'tr';

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
  cancelToken?: string;
}

// Site URL für Cancel-Links
const SITE_URL = Deno.env.get('SITE_URL') || 'https://orthopaedie-koenigstrasse.de';

// Praxis-Informationen (bleiben immer Deutsch)
const PRACTICE_INFO = {
  name: 'Orthopädie Königstraße',
  address: 'Königstraße 51',
  city: '30175 Hannover',
  phone: '0511 123456',
  email: 'praxis@orthopaedie-koenigstrasse.de',
  website: 'https://orthopaedie-koenigstrasse.de',
};

// Übersetzungen für E-Mail-Texte
const i18n: Record<EmailLanguage, Record<string, string>> = {
  de: {
    confirmationSubtitle: 'Terminbestätigung',
    greeting: 'Guten Tag',
    confirmationIntro: 'vielen Dank für Ihre Terminbuchung. Ihr Termin wurde erfolgreich registriert.',
    detailsTitle: 'Ihre Termindetails',
    labelDate: 'Datum:',
    labelTime: 'Uhrzeit:',
    labelTreatment: 'Terminart:',
    labelPractitioner: 'Behandler:',
    labelSpecialty: 'Fachgebiet:',
    noPractitioner: 'Nächster verfügbarer Behandler',
    addressTitle: 'Praxisadresse',
    hintTitle: 'Bitte beachten Sie:',
    hintText: 'Eine kostenfreie Stornierung ist bis 24 Stunden vor dem Termin möglich. Sie erhalten 24 Stunden und 6 Stunden vor Ihrem Termin eine Erinnerung per E-Mail.',
    cancelLinkText: 'Termin stornieren',
    contactText: 'Bei Fragen erreichen Sie uns telefonisch unter',
    contactOr: 'oder per E-Mail an',
    lookForward: 'Wir freuen uns auf Ihren Besuch!',
    regards: 'Mit freundlichen Grüßen',
    team: 'Ihr Praxisteam',
    reminderSubtitle: 'Terminerinnerung',
    reminderTodayTitle: 'Ihr Termin heute',
    reminderTomorrowTitle: 'Ihr Termin morgen',
    reminderTodayIntro: 'Wir möchten Sie an Ihren heutigen Termin erinnern.',
    reminderTomorrowIntro: 'Wir möchten Sie an Ihren morgigen Termin erinnern.',
    cancellationHint: 'Eine kostenfreie Stornierung ist noch bis',
    cancellationHintSuffix: 'möglich.',
    questionsText: 'Bei Fragen erreichen Sie uns telefonisch unter',
  },
  en: {
    confirmationSubtitle: 'Appointment Confirmation',
    greeting: 'Dear',
    confirmationIntro: 'Thank you for your appointment booking. Your appointment has been successfully registered.',
    detailsTitle: 'Your Appointment Details',
    labelDate: 'Date:',
    labelTime: 'Time:',
    labelTreatment: 'Treatment:',
    labelPractitioner: 'Practitioner:',
    labelSpecialty: 'Specialty:',
    noPractitioner: 'Next available practitioner',
    addressTitle: 'Practice Address',
    hintTitle: 'Please note:',
    hintText: 'Free cancellation is possible up to 24 hours before the appointment. You will receive a reminder email 24 hours and 6 hours before your appointment.',
    cancelLinkText: 'Cancel Appointment',
    contactText: 'For questions, you can reach us by phone at',
    contactOr: 'or by email at',
    lookForward: 'We look forward to your visit!',
    regards: 'Best regards',
    team: 'Your Practice Team',
    reminderSubtitle: 'Appointment Reminder',
    reminderTodayTitle: 'Your Appointment Today',
    reminderTomorrowTitle: 'Your Appointment Tomorrow',
    reminderTodayIntro: 'We would like to remind you of your appointment today.',
    reminderTomorrowIntro: 'We would like to remind you of your appointment tomorrow.',
    cancellationHint: 'Free cancellation is still possible until',
    cancellationHintSuffix: '.',
    questionsText: 'For questions, you can reach us by phone at',
  },
  tr: {
    confirmationSubtitle: 'Randevu Onayı',
    greeting: 'Sayın',
    confirmationIntro: 'Randevu kaydınız için teşekkür ederiz. Randevunuz başarıyla oluşturulmuştur.',
    detailsTitle: 'Randevu Detaylarınız',
    labelDate: 'Tarih:',
    labelTime: 'Saat:',
    labelTreatment: 'Tedavi:',
    labelPractitioner: 'Doktor:',
    labelSpecialty: 'Uzmanlık:',
    noPractitioner: 'Müsait olan doktor',
    addressTitle: 'Muayenehane Adresi',
    hintTitle: 'Lütfen dikkat:',
    hintText: 'Randevudan 24 saat öncesine kadar ücretsiz iptal mümkündür. Randevunuzdan 24 saat ve 6 saat önce e-posta ile hatırlatma alacaksınız.',
    cancelLinkText: 'Randevuyu İptal Et',
    contactText: 'Sorularınız için bize telefonla ulaşabilirsiniz:',
    contactOr: 'veya e-posta ile:',
    lookForward: 'Ziyaretinizi bekliyoruz!',
    regards: 'Saygılarımızla',
    team: 'Muayenehane Ekibiniz',
    reminderSubtitle: 'Randevu Hatırlatması',
    reminderTodayTitle: 'Bugünkü Randevunuz',
    reminderTomorrowTitle: 'Yarınki Randevunuz',
    reminderTodayIntro: 'Bugünkü randevunuzu hatırlatmak isteriz.',
    reminderTomorrowIntro: 'Yarınki randevunuzu hatırlatmak isteriz.',
    cancellationHint: 'Ücretsiz iptal hâlâ şu tarihe kadar mümkündür:',
    cancellationHintSuffix: '.',
    questionsText: 'Sorularınız için bize telefonla ulaşabilirsiniz:',
  },
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

const localeMap: Record<EmailLanguage, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR',
};

function formatDate(dateStr: string, lang: EmailLanguage = 'de'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(localeMap[lang], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(timeStr: string, lang: EmailLanguage = 'de'): string {
  const hhmm = timeStr.slice(0, 5);
  if (lang === 'de') return hhmm + ' Uhr';
  return hhmm;
}

function t(lang: EmailLanguage, key: string): string {
  return i18n[lang]?.[key] ?? i18n.de[key] ?? key;
}

/**
 * E-Mail-Betreff für Buchungsbestätigung
 */
export function getConfirmationSubject(lang: EmailLanguage = 'de'): string {
  const subjects: Record<EmailLanguage, string> = {
    de: 'Ihre Terminbestätigung - Orthopädie Königstraße',
    en: 'Your Appointment Confirmation - Orthopädie Königstraße',
    tr: 'Randevu Onayınız - Orthopädie Königstraße',
  };
  return subjects[lang] ?? subjects.de;
}

/**
 * E-Mail-Betreff für Erinnerungen
 */
export function getReminderSubject(reminderType: '24h_before' | '6h_before', lang: EmailLanguage = 'de'): string {
  const isToday = reminderType === '6h_before';
  const subjects: Record<EmailLanguage, { today: string; tomorrow: string }> = {
    de: {
      today: 'Erinnerung: Ihr Termin heute - Orthopädie Königstraße',
      tomorrow: 'Erinnerung: Ihr Termin morgen - Orthopädie Königstraße',
    },
    en: {
      today: 'Reminder: Your Appointment Today - Orthopädie Königstraße',
      tomorrow: 'Reminder: Your Appointment Tomorrow - Orthopädie Königstraße',
    },
    tr: {
      today: 'Hatırlatma: Bugünkü Randevunuz - Orthopädie Königstraße',
      tomorrow: 'Hatırlatma: Yarınki Randevunuz - Orthopädie Königstraße',
    },
  };
  const s = subjects[lang] ?? subjects.de;
  return isToday ? s.today : s.tomorrow;
}

/**
 * Buchungsbestätigung für Patienten (mehrsprachig)
 */
export function generateBookingConfirmationEmail(data: AppointmentData, lang: EmailLanguage = 'de'): string {
  const practitioner = data.practitionerName || t(lang, 'noPractitioner');
  const htmlLang = lang === 'tr' ? 'tr' : lang === 'en' ? 'en' : 'de';

  return `
<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t(lang, 'confirmationSubtitle')}</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <!-- Header -->
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">${PRACTICE_INFO.name}</h1>
      <p style="${styles.headerSubtitle}">${t(lang, 'confirmationSubtitle')}</p>
    </div>

    <!-- Content -->
    <div style="${styles.content}">
      <p style="${styles.greeting}">${t(lang, 'greeting')} ${data.patientName},</p>

      <p style="${styles.text}">
        ${t(lang, 'confirmationIntro')}
      </p>

      <!-- Termindetails -->
      <div style="${styles.detailsBox}">
        <h2 style="${styles.detailsTitle}">${t(lang, 'detailsTitle')}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 120px;">${t(lang, 'labelDate')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatDate(data.date, lang)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelTime')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatTime(data.time, lang)} - ${formatTime(data.endTime, lang)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelTreatment')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.treatmentType}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelPractitioner')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${practitioner}</td>
          </tr>
          ${data.specialtyName ? `
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelSpecialty')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.specialtyName}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Praxisadresse -->
      <div style="${styles.addressBox}">
        <h3 style="${styles.addressTitle}">${t(lang, 'addressTitle')}</h3>
        <p style="${styles.addressText}">
          ${PRACTICE_INFO.name}<br>
          ${PRACTICE_INFO.address}<br>
          ${PRACTICE_INFO.city}<br>
          Tel: ${PRACTICE_INFO.phone}
        </p>
      </div>

      <!-- Hinweise -->
      <div style="${styles.hint}">
        <strong>${t(lang, 'hintTitle')}</strong><br>
        ${t(lang, 'hintText')}
      </div>

      ${data.cancelToken ? `
      <!-- Stornierungslink -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}/cancel.html?token=${data.cancelToken}" style="display: inline-block; padding: 12px 24px; background-color: #DC3545; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          ${t(lang, 'cancelLinkText')}
        </a>
      </div>
      ` : ''}

      <p style="${styles.text}">
        ${t(lang, 'contactText')} ${PRACTICE_INFO.phone} ${t(lang, 'contactOr')}
        <a href="mailto:${PRACTICE_INFO.email}" style="color: #2674BB;">${PRACTICE_INFO.email}</a>.
      </p>

      <p style="${styles.text}">
        ${t(lang, 'lookForward')}
      </p>

      <p style="${styles.text}">
        ${t(lang, 'regards')}<br>
        <strong>${t(lang, 'team')}</strong><br>
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
 * Benachrichtigung für die Praxis (bleibt Deutsch)
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
 * Erinnerungs-E-Mail (24h oder 6h vor Termin, mehrsprachig)
 */
export function generateReminderEmail(data: AppointmentData, reminderType: '24h_before' | '6h_before', lang: EmailLanguage = 'de'): string {
  const practitioner = data.practitionerName || t(lang, 'noPractitioner');
  const isToday = reminderType === '6h_before';
  const title = isToday ? t(lang, 'reminderTodayTitle') : t(lang, 'reminderTomorrowTitle');
  const intro = isToday ? t(lang, 'reminderTodayIntro') : t(lang, 'reminderTomorrowIntro');
  const htmlLang = lang === 'tr' ? 'tr' : lang === 'en' ? 'en' : 'de';

  return `
<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t(lang, 'reminderSubtitle')}</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <!-- Header -->
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">${PRACTICE_INFO.name}</h1>
      <p style="${styles.headerSubtitle}">${t(lang, 'reminderSubtitle')}</p>
    </div>

    <!-- Content -->
    <div style="${styles.content}">
      <p style="${styles.greeting}">${t(lang, 'greeting')} ${data.patientName},</p>

      <p style="${styles.text}">${intro}</p>

      <!-- Termindetails -->
      <div style="${styles.detailsBox}">
        <h2 style="${styles.detailsTitle}">${title}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 120px;">${t(lang, 'labelDate')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatDate(data.date, lang)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelTime')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${formatTime(data.time, lang)} - ${formatTime(data.endTime, lang)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelTreatment')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${data.treatmentType}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">${t(lang, 'labelPractitioner')}</td>
            <td style="padding: 6px 0; color: #000000; font-weight: 500;">${practitioner}</td>
          </tr>
        </table>
      </div>

      <!-- Praxisadresse -->
      <div style="${styles.addressBox}">
        <h3 style="${styles.addressTitle}">${t(lang, 'addressTitle')}</h3>
        <p style="${styles.addressText}">
          ${PRACTICE_INFO.name}<br>
          ${PRACTICE_INFO.address}<br>
          ${PRACTICE_INFO.city}<br>
          Tel: ${PRACTICE_INFO.phone}
        </p>
      </div>

      ${!isToday && data.cancellationDeadline ? `
      <div style="${styles.hint}">
        <strong>${lang === 'de' ? 'Hinweis:' : lang === 'en' ? 'Note:' : 'Not:'}</strong> ${t(lang, 'cancellationHint')} ${data.cancellationDeadline} ${t(lang, 'cancellationHintSuffix')}
      </div>
      ` : ''}

      ${!isToday && data.cancelToken ? `
      <!-- Stornierungslink -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}/cancel.html?token=${data.cancelToken}" style="display: inline-block; padding: 12px 24px; background-color: #DC3545; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          ${t(lang, 'cancelLinkText')}
        </a>
      </div>
      ` : ''}

      <p style="${styles.text}">
        ${t(lang, 'questionsText')} ${PRACTICE_INFO.phone}.
      </p>

      <p style="${styles.text}">
        ${t(lang, 'lookForward')}
      </p>

      <p style="${styles.text}">
        ${t(lang, 'regards')}<br>
        <strong>${t(lang, 'team')}</strong><br>
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
