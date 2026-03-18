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
  completed_by: string | null;
  patient: {
    name: string;
    phone: string;
    email: string | null;
  };
  completer?: {
    display_name: string;
  } | null;
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

type Tab = 'offen' | 'erledigt';
type DateRange = '7' | '30' | 'alle';

export function PrescriptionsPage() {
  const [openOrders, setOpenOrders] = useState<PrescriptionOrder[]>([]);
  const [doneOrders, setDoneOrders] = useState<PrescriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('offen');
  const [typeFilter, setTypeFilter] = useState<string>('alle');
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const { user } = useAuth();

  // Profilnamen für completed_by auflösen
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    // Offene Vorbestellungen (älteste zuerst)
    let openQuery = supabase
      .from('prescription_orders')
      .select('*, patient:patients(name, phone, email)')
      .in('status', ['neu', 'in_bearbeitung'])
      .order('created_at', { ascending: true });

    if (typeFilter !== 'alle') {
      openQuery = openQuery.eq('order_type', typeFilter);
    }

    // Erledigte Vorbestellungen (neueste zuerst)
    let doneQuery = supabase
      .from('prescription_orders')
      .select('*, patient:patients(name, phone, email)')
      .eq('status', 'erledigt')
      .order('completed_at', { ascending: false });

    if (typeFilter !== 'alle') {
      doneQuery = doneQuery.eq('order_type', typeFilter);
    }

    // Datumsfilter für Erledigte
    if (dateRange !== 'alle') {
      const days = parseInt(dateRange);
      const since = new Date();
      since.setDate(since.getDate() - days);
      doneQuery = doneQuery.gte('completed_at', since.toISOString());
    }

    const [openRes, doneRes] = await Promise.all([openQuery, doneQuery]);

    const open = (openRes.data || []) as PrescriptionOrder[];
    const done = (doneRes.data || []) as PrescriptionOrder[];
    setOpenOrders(open);
    setDoneOrders(done);

    // Profilnamen laden für completed_by
    const completedByIds = [...new Set(done.filter(o => o.completed_by).map(o => o.completed_by!))];
    if (completedByIds.length > 0) {
      const { data: profiles } = await supabase
        .from('admin_profiles')
        .select('id, display_name')
        .in('id', completedByIds);

      const nameMap = new Map<string, string>();
      (profiles || []).forEach((p: any) => nameMap.set(p.id, p.display_name));
      setProfileNames(nameMap);
    }

    setLoading(false);
  }, [typeFilter, dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const updates: Record<string, any> = { status: newStatus };
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

  const displayOrders = activeTab === 'offen' ? openOrders : doneOrders;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Vorbestellungen</h1>
        <button className={styles.refreshButton} onClick={fetchOrders}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Aktualisieren
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'offen' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('offen')}
        >
          Offen
          <span className={styles.tabBadge} style={{ background: '#FEF3C7', color: '#92400E' }}>
            {openOrders.length}
          </span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'erledigt' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('erledigt')}
        >
          Erledigt
          <span className={styles.tabBadge} style={{ background: '#D1FAE5', color: '#065F46' }}>
            {doneOrders.length}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
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
        {activeTab === 'erledigt' && (
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Zeitraum:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className={styles.filterSelect}
            >
              <option value="7">Letzte 7 Tage</option>
              <option value="30">Letzte 30 Tage</option>
              <option value="alle">Alle</option>
            </select>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.loading}>Lade Vorbestellungen...</div>
      ) : displayOrders.length === 0 ? (
        <div className={styles.empty}>
          {activeTab === 'offen' ? 'Keine offenen Vorbestellungen.' : 'Keine erledigten Vorbestellungen im gewählten Zeitraum.'}
        </div>
      ) : (
        <div className={styles.list}>
          {displayOrders.map(order => (
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
                  <span className={styles.fieldLabel}>Eingegangen</span>
                  <span className={styles.fieldValue}>{formatDate(order.created_at)}</span>
                </div>
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
                {order.note && (
                  <div className={styles.orderField}>
                    <span className={styles.fieldLabel}>Bemerkung</span>
                    <span className={styles.fieldValue}>{order.note}</span>
                  </div>
                )}
                {order.completed_at && (
                  <div className={styles.orderField}>
                    <span className={styles.fieldLabel}>Erledigt am</span>
                    <span className={styles.fieldValue}>{formatDate(order.completed_at)}</span>
                  </div>
                )}
                {order.completed_by && (
                  <div className={styles.orderField}>
                    <span className={styles.fieldLabel}>Erledigt von</span>
                    <span className={styles.fieldValue}>
                      {profileNames.get(order.completed_by) || '–'}
                    </span>
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
