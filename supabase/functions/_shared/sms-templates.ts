// ORTHO-040: SMS Templates (mehrsprachig)
// Plain-text SMS templates for patients without email

import type { AppointmentData, EmailLanguage } from './email-templates.ts'

const PRACTICE_NAME = 'Orthopädie Königstraße';
const PRACTICE_ADDRESS = 'Berliner Allee 14, 30175 Hannover';
const PRACTICE_PHONE = '0511 34833-0';

const localeMap: Record<string, string> = {
  de: 'de-DE', en: 'en-US', tr: 'tr-TR', ru: 'ru-RU', ar: 'ar-SA',
};

function fmtDate(dateStr: string, lang: EmailLanguage): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(localeMap[lang] || 'de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtTime(timeStr: string, lang: EmailLanguage): string {
  const hhmm = timeStr.slice(0, 5);
  return lang === 'de' ? hhmm + ' Uhr' : hhmm;
}

function provider(data: AppointmentData, lang: EmailLanguage): string {
  if (data.practitionerName) return data.practitionerName;
  const fallback: Record<string, string> = {
    de: 'Praxisleistung', en: 'Practice Service',
    tr: 'Muayenehane Hizmeti', ru: 'Услуга клиники', ar: 'خدمة العيادة',
  };
  return fallback[lang] || fallback.de;
}

// ================== CONFIRMATION SMS ==================

const confirmationTemplates: Record<EmailLanguage, (d: AppointmentData) => string> = {
  de: (d) => `Ihr Termin am ${fmtDate(d.date, 'de')} um ${fmtTime(d.time, 'de')} bei ${provider(d, 'de')}, ${PRACTICE_NAME}, ${PRACTICE_ADDRESS}. Stornierung telefonisch unter ${PRACTICE_PHONE}`,
  en: (d) => `Your appointment on ${fmtDate(d.date, 'en')} at ${fmtTime(d.time, 'en')} with ${provider(d, 'en')}, ${PRACTICE_NAME}, ${PRACTICE_ADDRESS}. Cancellation by phone: ${PRACTICE_PHONE}`,
  tr: (d) => `Randevunuz ${fmtDate(d.date, 'tr')} tarihinde ${fmtTime(d.time, 'tr')}, ${provider(d, 'tr')}, ${PRACTICE_NAME}, ${PRACTICE_ADDRESS}. İptal için: ${PRACTICE_PHONE}`,
  ru: (d) => `Ваш приём ${fmtDate(d.date, 'ru')} в ${fmtTime(d.time, 'ru')} у ${provider(d, 'ru')}, ${PRACTICE_NAME}, ${PRACTICE_ADDRESS}. Отмена по телефону: ${PRACTICE_PHONE}`,
  ar: (d) => `موعدك يوم ${fmtDate(d.date, 'ar')} الساعة ${fmtTime(d.time, 'ar')} مع ${provider(d, 'ar')}، ${PRACTICE_NAME}، ${PRACTICE_ADDRESS}. للإلغاء: ${PRACTICE_PHONE}`,
};

export function getConfirmationSms(data: AppointmentData, lang: EmailLanguage = 'de'): string {
  return (confirmationTemplates[lang] || confirmationTemplates.de)(data);
}

// ================== REMINDER SMS ==================

const reminderTemplates: Record<EmailLanguage, (d: AppointmentData) => string> = {
  de: (d) => `Erinnerung: Morgen ${fmtDate(d.date, 'de')} um ${fmtTime(d.time, 'de')} bei ${provider(d, 'de')}, ${PRACTICE_NAME}. Absage unter ${PRACTICE_PHONE}`,
  en: (d) => `Reminder: Tomorrow ${fmtDate(d.date, 'en')} at ${fmtTime(d.time, 'en')} with ${provider(d, 'en')}, ${PRACTICE_NAME}. Cancel: ${PRACTICE_PHONE}`,
  tr: (d) => `Hatırlatma: Yarın ${fmtDate(d.date, 'tr')} ${fmtTime(d.time, 'tr')}, ${provider(d, 'tr')}, ${PRACTICE_NAME}. İptal: ${PRACTICE_PHONE}`,
  ru: (d) => `Напоминание: завтра ${fmtDate(d.date, 'ru')} в ${fmtTime(d.time, 'ru')} у ${provider(d, 'ru')}, ${PRACTICE_NAME}. Отмена: ${PRACTICE_PHONE}`,
  ar: (d) => `تذكير: غداً ${fmtDate(d.date, 'ar')} الساعة ${fmtTime(d.time, 'ar')} مع ${provider(d, 'ar')}، ${PRACTICE_NAME}. للإلغاء: ${PRACTICE_PHONE}`,
};

export function getReminderSms(data: AppointmentData, lang: EmailLanguage = 'de'): string {
  return (reminderTemplates[lang] || reminderTemplates.de)(data);
}

// ================== RESCHEDULE SMS ==================

const rescheduleTemplates: Record<EmailLanguage, (d: AppointmentData) => string> = {
  de: (d) => `Ihr Termin wurde verlegt auf ${fmtDate(d.date, 'de')} um ${fmtTime(d.time, 'de')} bei ${provider(d, 'de')}, ${PRACTICE_NAME}. Fragen: ${PRACTICE_PHONE}`,
  en: (d) => `Your appointment has been rescheduled to ${fmtDate(d.date, 'en')} at ${fmtTime(d.time, 'en')} with ${provider(d, 'en')}, ${PRACTICE_NAME}. Questions: ${PRACTICE_PHONE}`,
  tr: (d) => `Randevunuz ${fmtDate(d.date, 'tr')} ${fmtTime(d.time, 'tr')} tarihine değiştirildi, ${provider(d, 'tr')}, ${PRACTICE_NAME}. Sorular: ${PRACTICE_PHONE}`,
  ru: (d) => `Ваш приём перенесён на ${fmtDate(d.date, 'ru')} в ${fmtTime(d.time, 'ru')} у ${provider(d, 'ru')}, ${PRACTICE_NAME}. Вопросы: ${PRACTICE_PHONE}`,
  ar: (d) => `تم تغيير موعدك إلى ${fmtDate(d.date, 'ar')} الساعة ${fmtTime(d.time, 'ar')} مع ${provider(d, 'ar')}، ${PRACTICE_NAME}. استفسارات: ${PRACTICE_PHONE}`,
};

export function getRescheduleSms(data: AppointmentData, lang: EmailLanguage = 'de'): string {
  return (rescheduleTemplates[lang] || rescheduleTemplates.de)(data);
}

// ================== PRACTICE CANCELLATION SMS ==================

const cancellationTemplates: Record<EmailLanguage, (d: AppointmentData) => string> = {
  de: (d) => `Ihr Termin am ${fmtDate(d.date, 'de')} um ${fmtTime(d.time, 'de')} wurde leider abgesagt. Neuen Termin unter ${PRACTICE_PHONE} oder online buchen.`,
  en: (d) => `Your appointment on ${fmtDate(d.date, 'en')} at ${fmtTime(d.time, 'en')} has been cancelled. Reschedule at ${PRACTICE_PHONE} or book online.`,
  tr: (d) => `${fmtDate(d.date, 'tr')} ${fmtTime(d.time, 'tr')} tarihli randevunuz iptal edildi. Yeni randevu: ${PRACTICE_PHONE} veya online.`,
  ru: (d) => `Ваш приём ${fmtDate(d.date, 'ru')} в ${fmtTime(d.time, 'ru')} отменён. Новый приём: ${PRACTICE_PHONE} или онлайн.`,
  ar: (d) => `تم إلغاء موعدك يوم ${fmtDate(d.date, 'ar')} الساعة ${fmtTime(d.time, 'ar')}. لحجز موعد جديد: ${PRACTICE_PHONE} أو عبر الإنترنت.`,
};

export function getCancellationSms(data: AppointmentData, lang: EmailLanguage = 'de'): string {
  return (cancellationTemplates[lang] || cancellationTemplates.de)(data);
}
