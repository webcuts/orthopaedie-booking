import { useState } from 'react';
import { BookingWizard } from './components';
import { PrescriptionFlow } from './components/PrescriptionFlow/PrescriptionFlow';
import { LanguageProvider, LanguageSelector, useTranslation } from './i18n';
import { Container, Card } from './components';
import { useIframeResize } from './hooks';
import './styles/theme.css';

type AppView = 'choice' | 'booking' | 'prescription';

function ChoiceScreen({ onSelect }: { onSelect: (view: AppView) => void }) {
  const { t } = useTranslation();
  useIframeResize(['choice']);

  return (
    <Container size="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem' }}>
      <Card variant="elevated" padding="lg">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <LanguageSelector />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            {t('choice.title')}
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
            Orthopädie Königstraße, Hannover
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={() => onSelect('booking')}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem', background: 'white', border: '2px solid #E5E7EB',
              borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2674BB'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(38,116,187,0.12)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2674BB" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{t('choice.booking')}</div>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>{t('choice.bookingDesc')}</div>
            </div>
          </button>

          <button
            onClick={() => onSelect('prescription')}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem', background: 'white', border: '2px solid #E5E7EB',
              borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.12)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="M9 14l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{t('choice.prescription')}</div>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>{t('choice.prescriptionDesc')}</div>
            </div>
          </button>
        </div>
      </Card>
    </Container>
  );
}

function AppInner() {
  const [view, setView] = useState<AppView>('choice');

  if (view === 'booking') {
    return <BookingWizard />;
  }

  if (view === 'prescription') {
    return <PrescriptionFlow onBack={() => setView('choice')} />;
  }

  return <ChoiceScreen onSelect={setView} />;
}

function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}

export default App;
