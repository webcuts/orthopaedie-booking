import { useAnalytics } from '../../hooks';
import styles from './AnalyticsWidget.module.css';

export function AnalyticsWidget() {
  const { data, loading, error } = useAnalytics();

  if (loading) {
    return <div className={styles.loading}>Analytics werden geladen...</div>;
  }

  if (error || !data) {
    return <div className={styles.error}>{error || 'Keine Daten verfügbar'}</div>;
  }

  // Wochenvergleich berechnen
  const weekChange = data.bookingsLastWeek > 0
    ? Math.round(((data.bookingsThisWeek - data.bookingsLastWeek) / data.bookingsLastWeek) * 100)
    : data.bookingsThisWeek > 0 ? 100 : 0;

  const maxHourCount = Math.max(...data.hourlyDistribution.map(h => h.count), 1);

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {/* Buchungen diese Woche */}
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Buchungen diese Woche</p>
          <p className={styles.kpiValue}>{data.bookingsThisWeek}</p>
          {data.bookingsLastWeek > 0 && (
            <span className={`${styles.kpiChange} ${weekChange > 0 ? styles.kpiUp : weekChange < 0 ? styles.kpiDown : styles.kpiNeutral}`}>
              {weekChange > 0 ? '↑' : weekChange < 0 ? '↓' : '→'} {Math.abs(weekChange)}% vs. Vorwoche
            </span>
          )}
        </div>

        {/* Buchungen heute */}
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Buchungen heute</p>
          <p className={styles.kpiValue}>{data.bookingsToday}</p>
        </div>

        {/* Auslastung */}
        <div className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Auslastung diese Woche</p>
          {data.practitionerUtilization.length > 0 ? (
            <ul className={styles.utilizationList}>
              {data.practitionerUtilization.map((p) => (
                <li key={p.name} className={styles.utilizationItem}>
                  <span className={styles.utilizationName}>{p.name}</span>
                  <div className={styles.utilizationBarBg}>
                    <div className={styles.utilizationBarFill} style={{ width: `${p.percentage}%` }} />
                  </div>
                  <span className={styles.utilizationPercent}>{p.percentage}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.kpiValue} style={{ fontSize: '0.875rem', color: '#6B7280' }}>Keine Daten</p>
          )}
        </div>
      </div>

      {/* Beliebteste Uhrzeiten */}
      {data.hourlyDistribution.length > 0 && (
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Beliebteste Uhrzeiten</h3>
          {data.hourlyDistribution.map(({ hour, count }) => (
            <div key={hour} className={styles.chartRow}>
              <span className={styles.chartLabel}>{String(hour).padStart(2, '0')}:00</span>
              <div className={styles.chartBarBg}>
                <div
                  className={styles.chartBarFill}
                  style={{ width: `${(count / maxHourCount) * 100}%` }}
                />
              </div>
              <span className={styles.chartCount}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
