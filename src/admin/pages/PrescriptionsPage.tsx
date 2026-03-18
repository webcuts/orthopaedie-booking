import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../hooks';
import styles from './PrescriptionsPage.module.css';

interface PrescriptionOrder {
  id: string;
  order_type: 'rezept' | 'heilmittel' | 'ueberweisung';
  note: string | null;
  status: 'neu' | 'in_bearbeitung' | 'erledigt';
  created_at: string;
  completed_at: string | null;
  patient: {
    name: string;
    phone: string;
    email: string | null;
  };
}

const TYPE_LABELS: Record<string, string> = {
  rezept: 'Rezept / Medikamente',
  heilmittel: 'Heilmittelverordnung',
  ueberweisung: 'Überweisung',
};

const TYPE_COLORS: Record<string, string> = {
  rezept: '#7C3AED',
  heilmittel: '#2563EB',
  ueberweisung: '#059669',
};

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  neu: { bg: '#FEF3C7', text: '#92400E' },
  in_bearbeitung: { bg: '#DBEAFE', text: '#1E40AF' },
  erledigt: { bg: '#D1FAE5', text: '#065F46' },
};

export function PrescriptionsPage() {
  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('offen');
  const [typeFilter, setTypeFilter] = useState<string>('alle');
  const { user } = useAuth();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('prescription_orders')
      .select('*, patient:patients(name, phone, email)')
      .order('created_at', { ascending: false });

    if (statusFilter === 'offen') {
      query = query.in('status', ['neu', 'in_bearbeitung']);
    } else if (statusFilter === 'erledigt') {
      query = query.eq('status', 'erledigt');
    }

    if (typeFilter !== 'alle') {
      query = query.eq('order_type', typeFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setOrders(data as PrescriptionOrder[]);
    }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openCount = orders.filter(o => o.status !== 'erledigt').length;

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === 'erledigt') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = user?.id;
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    await supabase
      .from('prescription_orders')
      .update(updates)
      .eq('id', orderId);

    fetchOrders();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Vorbestellungen</h1>
          {statusFilter === 'offen' && openCount > 0 && (
            <span className={styles.badge}>{openCount} offen</span>
          )}
        </div>
        <button className={styles.refreshButton} onClick={fetchOrders}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Aktualisieren
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="offen">Offen</option>
            <option value="erledigt">Erledigt</option>
            <option value="alle">Alle</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Typ:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="alle">Alle Typen</option>
            <option value="rezept">Rezept</option>
            <option value="heilmittel">Heilmittel</option>
            <option value="ueberweisung">Überweisung</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.loading}>Lade Vorbestellungen...</div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>Keine Vorbestellungen gefunden.</div>
      ) : (
        <div className={styles.list}>
          {orders.map(order => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <span
                  className={styles.typeBadge}
                  style={{ background: TYPE_COLORS[order.order_type] + '15', color: TYPE_COLORS[order.order_type] }}
                >
                  {TYPE_LABELS[order.order_type]}
                </span>
                <span
                  className={styles.statusBadge}
                  style={{ background: STATUS_COLORS[order.status].bg, color: STATUS_COLORS[order.status].text }}
                >
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className={styles.orderBody}>
                <div className={styles.orderField}>
                  <span className={styles.fieldLabel}>Patient</span>
                  <span className={styles.fieldValue}>{order.patient?.name}</span>
                </div>
                <div className={styles.orderField}>
                  <span className={styles.fieldLabel}>Telefon</span>
                  <a href={`tel:${order.patient?.phone}`} className={styles.fieldLink}>
                    {order.patient?.phone}
                  </a>
                </div>
                {order.patient?.email && (
                  <div className={styles.orderField}>
                    <span className={styles.fieldLabel}>E-Mail</span>
                    <a href={`mailto:${order.patient.email}`} className={styles.fieldLink}>
                      {order.patient.email}
                    </a>
                  </div>
                )}
                {order.note && (
                  <div className={styles.orderField}>
                    <span className={styles.fieldLabel}>Bemerkung</span>
                    <span className={styles.fieldValue}>{order.note}</span>
                  </div>
                )}
                <div className={styles.orderField}>
                  <span className={styles.fieldLabel}>Eingegangen</span>
                  <span className={styles.fieldValue}>{formatDate(order.created_at)}</span>
                </div>
                {order.completed_at && (
                  <div className={styles.orderField}>
                    <span className={styles.fieldLabel}>Erledigt am</span>
                    <span className={styles.fieldValue}>{formatDate(order.completed_at)}</span>
                  </div>
                )}
              </div>

              <div className={styles.orderActions}>
                {order.status === 'neu' && (
                  <button
                    className={styles.actionButton}
                    style={{ background: '#DBEAFE', color: '#1E40AF' }}
                    onClick={() => handleStatusChange(order.id, 'in_bearbeitung')}
                  >
                    In Bearbeitung
                  </button>
                )}
                {order.status !== 'erledigt' && (
                  <button
                    className={styles.actionButton}
                    style={{ background: '#D1FAE5', color: '#065F46' }}
                    onClick={() => handleStatusChange(order.id, 'erledigt')}
                  >
                    Erledigt
                  </button>
                )}
                {order.status === 'erledigt' && (
                  <button
                    className={styles.actionButton}
                    style={{ background: '#FEF3C7', color: '#92400E' }}
                    onClick={() => handleStatusChange(order.id, 'neu')}
                  >
                    Wieder öffnen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
