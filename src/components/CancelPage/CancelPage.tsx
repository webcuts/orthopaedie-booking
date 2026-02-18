import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from '../../i18n';
import { LanguageSelector } from '../../i18n';
import styles from './CancelPage.module.css';

interface AppointmentDetails {
  id: string;
  status: string;
  time_slot: { date: string; start_time: string; end_time: string };
  treatment_type: { name: string };
  practitioner: { title: string | null; first_name: string; last_name: string } | null;
}

export function CancelPage() {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token');

  const localeMap: Record<string, string> = {
    de: 'de-DE',
    en: 'en-US',
    tr: 'tr-TR',
    ru: 'ru-RU',
    ar: 'ar-SA',
  };

  useEffect(() => {
    if (!token) {
      setError('cancel.invalidToken');
      setLoading(false);
      return;
    }

    async function fetchAppointment() {
      try {
        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select(`
            id,
            status,
            time_slot:time_slots(date, start_time, end_time),
            treatment_type:treatment_types(name),
            practitioner:practitioners(title, first_name, last_name)
          `)
          .eq('cancel_token', token)
          .single();

        if (fetchError || !data) {
          setError('cancel.invalidToken');
          return;
        }

        if (data.status === 'cancelled') {
          setError('cancel.alreadyCancelled');
          return;
        }

        // Supabase returns joins as arrays — extract first element
        const timeSlot = Array.isArray(data.time_slot) ? data.time_slot[0] : data.time_slot;
        const treatmentType = Array.isArray(data.treatment_type) ? data.treatment_type[0] : data.treatment_type;
        const practitioner = Array.isArray(data.practitioner) ? data.practitioner[0] || null : data.practitioner;

        // Check if appointment is in the past
        const appointmentDate = new Date(`${timeSlot.date}T${timeSlot.start_time}`);
        if (appointmentDate < new Date()) {
          setError('cancel.pastAppointment');
          return;
        }

        // Check 24h deadline
        const deadline = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
        if (new Date() > deadline) {
          setError('cancel.deadline');
          return;
        }

        setAppointment({
          id: data.id,
          status: data.status,
          time_slot: timeSlot,
          treatment_type: treatmentType,
          practitioner,
        });
      } catch {
        setError('cancel.error');
      } finally {
        setLoading(false);
      }
    }

    fetchAppointment();
  }, [token]);

  const handleCancel = async () => {
    if (!token) return;
    setCancelling(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cancel-appointment', {
        body: { cancel_token: token },
      });

      if (fnError || !data?.success) {
        setError(data?.error_key || 'cancel.error');
        return;
      }

      setSuccess(true);
    } catch {
      setError('cancel.error');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(localeMap[language] || 'de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const hhmm = time.slice(0, 5);
    if (language === 'de') return hhmm + ' Uhr';
    return hhmm;
  };

  const practitionerName = appointment?.practitioner
    ? `${appointment.practitioner.title || ''} ${appointment.practitioner.first_name} ${appointment.practitioner.last_name}`.trim()
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.practiceName}>Orthopädie Königstraße</p>
        <h1 className={styles.title}>{t('cancel.title')}</h1>
        <div style={{ marginTop: '0.75rem' }}>
          <LanguageSelector />
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>{t('cancel.loading')}</span>
        </div>
      )}

      {success && (
        <>
          <div className={styles.successBox}>
            <svg className={styles.successIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2 className={styles.successTitle}>{t('cancel.successTitle')}</h2>
            <p className={styles.successText}>{t('cancel.success')}</p>
          </div>
          <a href="/" className={styles.backLink}>{t('cancel.backToBooking')}</a>
        </>
      )}

      {error && !loading && !success && (
        <>
          <div className={styles.errorBox}>
            <h2 className={styles.errorTitle}>{t('cancel.title')}</h2>
            <p className={styles.errorText}>{t(error)}</p>
          </div>
          <a href="/" className={styles.backLink}>{t('cancel.backToBooking')}</a>
        </>
      )}

      {appointment && !success && !error && (
        <>
          <div className={styles.detailsBox}>
            <h2 className={styles.detailsTitle}>{t('cancel.appointmentDetails')}</h2>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>{t('cancel.labelDate')}</span>
              <span className={styles.detailValue}>{formatDate(appointment.time_slot.date)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>{t('cancel.labelTime')}</span>
              <span className={styles.detailValue}>
                {formatTime(appointment.time_slot.start_time)} - {formatTime(appointment.time_slot.end_time)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>{t('cancel.labelTreatment')}</span>
              <span className={styles.detailValue}>{appointment.treatment_type.name}</span>
            </div>
            {practitionerName && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('cancel.labelPractitioner')}</span>
                <span className={styles.detailValue}>{practitionerName}</span>
              </div>
            )}
          </div>

          <div className={styles.warning}>
            {t('cancel.deadline')}
          </div>

          <button
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? t('cancel.confirming') : t('cancel.confirm')}
          </button>
        </>
      )}
    </div>
  );
}
