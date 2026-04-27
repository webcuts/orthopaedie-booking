import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useAuth } from '../hooks';
import {
  useShiftTemplates,
  useMfaStaff,
  useWeeklySchedule,
  useOwnWeeklyShifts,
  getMondayOf,
  addDays,
  formatDate,
  getWeekDates,
  ensureScheduleForWeek,
  publishSchedule,
  unpublishSchedule,
  duplicateWeek,
  updateTeamNote,
  createShift,
  updateShift,
  deleteShift,
} from '../hooks/useDienstplan';
import type { Shift, ShiftTemplate, StaffMember, ShiftType } from '../../types/database';
import styles from './DienstplanPage.module.css';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function formatTime(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

function formatShiftRange(shift: Shift | { start_time: string | null; end_time: string | null; ends_with_closing: boolean }): string {
  if (!shift.start_time) return '';
  const start = formatTime(shift.start_time);
  if (shift.ends_with_closing) return `${start}–Ende`;
  return shift.end_time ? `${start}–${formatTime(shift.end_time)}` : start;
}

function formatWeekLabel(monday: Date): string {
  const sa = addDays(monday, 5);
  const m = String(monday.getDate()).padStart(2, '0');
  const s = String(sa.getDate()).padStart(2, '0');
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const sm = String(sa.getMonth() + 1).padStart(2, '0');
  return `KW${getWeekNumber(monday)} · ${m}.${mm} – ${s}.${sm}.${monday.getFullYear()}`;
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// =====================================================
// Draggable Template (Sidebar)
// =====================================================
function DraggableTemplate({ tpl }: { tpl: ShiftTemplate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${tpl.id}`,
    data: { kind: 'template', template: tpl },
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.template}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <div className={styles.templateColor} style={{ background: tpl.color }} />
      <span className={styles.templateName}>{tpl.name}</span>
      <span className={styles.templateTime}>
        {formatTime(tpl.start_time)}{tpl.ends_with_closing ? '–Ende' : tpl.end_time ? `–${formatTime(tpl.end_time)}` : ''}
      </span>
    </div>
  );
}

// =====================================================
// Absence Template (non-DnD preset)
// =====================================================
const ABSENCE_PRESETS: { type: ShiftType; label: string; color: string }[] = [
  { type: 'vacation', label: 'Urlaub', color: '#EA580C' },
  { type: 'sick', label: 'Krank', color: '#DC2626' },
  { type: 'off', label: 'Frei', color: '#6B7280' },
];

function DraggableAbsence({ preset }: { preset: { type: ShiftType; label: string; color: string } }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `absence-${preset.type}`,
    data: { kind: 'absence', absence: preset },
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.template}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <div className={styles.templateColor} style={{ background: preset.color }} />
      <span className={styles.templateName}>{preset.label}</span>
    </div>
  );
}

// =====================================================
// Droppable Cell
// =====================================================
interface CellProps {
  staffId: string;
  date: Date;
  shifts: Shift[];
  onCellClick: () => void;
  onShiftClick: (s: Shift) => void;
}
function Cell({ staffId, date, shifts, onCellClick, onShiftClick }: CellProps) {
  const dropId = `cell-${staffId}-${formatDate(date)}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { kind: 'cell', staffId, date: formatDate(date) },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.gridCell} ${isOver ? styles.gridCellDrop : ''}`}
      onClick={onCellClick}
    >
      {shifts.map(s => <ShiftBlock key={s.id} shift={s} onClick={(e) => { e.stopPropagation(); onShiftClick(s); }} />)}
      {shifts.length === 0 && <span className={styles.addHint}>+</span>}
    </div>
  );
}

// =====================================================
// Draggable Shift Block (inside cell)
// =====================================================
function ShiftBlock({ shift, onClick }: { shift: Shift; onClick: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `shift-${shift.id}`,
    data: { kind: 'shift', shift },
  });

  const typeClass =
    shift.shift_type === 'vacation' ? styles.shiftVacation :
    shift.shift_type === 'sick' ? styles.shiftSick :
    shift.shift_type === 'off' ? styles.shiftOff : '';

  return (
    <div
      ref={setNodeRef}
      className={`${styles.shiftBlock} ${typeClass}`}
      style={{
        background: shift.shift_type === 'work' ? (shift.color || '#2674BB') : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      {shift.shift_type === 'work' ? (
        <>
          <span className={styles.shiftTime}>{formatShiftRange(shift)}</span>
          {shift.note && <span className={styles.shiftName}>{shift.note}</span>}
        </>
      ) : (
        <span className={styles.shiftName}>
          {shift.shift_type === 'vacation' ? 'Urlaub' :
           shift.shift_type === 'sick' ? 'Krank' : 'Frei'}
        </span>
      )}
    </div>
  );
}

// =====================================================
// Create Modal (free time input, no template)
// =====================================================
interface CreateShiftProps {
  staffId: string;
  staffName: string;
  date: string;
  onSave: (input: {
    start_time: string | null;
    end_time: string | null;
    ends_with_closing: boolean;
    shift_type: ShiftType;
    note: string | null;
  }) => Promise<void>;
  onClose: () => void;
}
function CreateShiftDialog({ staffName, date, onSave, onClose }: CreateShiftProps) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endsWithClosing, setEndsWithClosing] = useState(false);
  const [shiftType, setShiftType] = useState<ShiftType>('work');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const handleSave = async () => {
    if (shiftType === 'work' && !startTime) return;
    if (shiftType === 'work' && !endsWithClosing && !endTime) return;
    setSaving(true);
    try {
      await onSave({
        start_time: shiftType === 'work' ? `${startTime}:00` : null,
        end_time: shiftType === 'work' && !endsWithClosing ? `${endTime}:00` : null,
        ends_with_closing: shiftType === 'work' ? endsWithClosing : false,
        shift_type: shiftType,
        note: note.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Neue Schicht für {staffName}</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: '0.25rem' }}>
            {dateLabel}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Typ</label>
            <select
              className={styles.select}
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as ShiftType)}
            >
              <option value="work">Arbeit</option>
              <option value="vacation">Urlaub</option>
              <option value="sick">Krank</option>
              <option value="off">Frei</option>
            </select>
          </div>

          {shiftType === 'work' && (
            <>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Von</label>
                  <input type="time" className={styles.input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Bis</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={endsWithClosing ? '' : endTime}
                    disabled={endsWithClosing}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={endsWithClosing} onChange={(e) => setEndsWithClosing(e.target.checked)} />
                bis Praxisende
              </label>
            </>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Notiz (optional)</label>
            <input type="text" className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Rezeption, Bestellungen" />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose} disabled={saving}>Abbrechen</button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSave}
            disabled={saving || (shiftType === 'work' && (!startTime || (!endsWithClosing && !endTime)))}
          >
            {saving ? 'Speichern...' : 'Schicht anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Edit Modal
// =====================================================
interface ShiftEditorProps {
  shift: Shift;
  onSave: (updates: Partial<Shift>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}
function ShiftEditor({ shift, onSave, onDelete, onClose }: ShiftEditorProps) {
  const [startTime, setStartTime] = useState(shift.start_time?.slice(0, 5) || '');
  const [endTime, setEndTime] = useState(shift.end_time?.slice(0, 5) || '');
  const [endsWithClosing, setEndsWithClosing] = useState(shift.ends_with_closing);
  const [shiftType, setShiftType] = useState<ShiftType>(shift.shift_type);
  const [note, setNote] = useState(shift.note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        start_time: shiftType === 'work' ? (startTime ? `${startTime}:00` : null) : null,
        end_time: shiftType === 'work' && !endsWithClosing ? (endTime ? `${endTime}:00` : null) : null,
        ends_with_closing: shiftType === 'work' ? endsWithClosing : false,
        shift_type: shiftType,
        note: note.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Schicht bearbeiten</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Typ</label>
            <select
              className={styles.select}
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as ShiftType)}
            >
              <option value="work">Arbeit</option>
              <option value="vacation">Urlaub</option>
              <option value="sick">Krank</option>
              <option value="off">Frei</option>
            </select>
          </div>

          {shiftType === 'work' && (
            <>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Von</label>
                  <input type="time" className={styles.input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Bis</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={endsWithClosing ? '' : endTime}
                    disabled={endsWithClosing}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={endsWithClosing} onChange={(e) => setEndsWithClosing(e.target.checked)} />
                bis Praxisende
              </label>
            </>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Notiz (optional)</label>
            <input type="text" className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Rezeption, Bestellungen" />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onDelete} disabled={saving}>
            Löschen
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.btn} onClick={onClose} disabled={saving}>Abbrechen</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Admin-Editor
// =====================================================
function AdminDienstplan() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const weekStartStr = formatDate(weekStart);
  const weekDates = getWeekDates(weekStart);

  const { data: templates } = useShiftTemplates();
  const { data: staff } = useMfaStaff();
  const { schedule, shifts, refetch } = useWeeklySchedule(weekStartStr);

  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [creatingShift, setCreatingShift] = useState<{ staffId: string; staffName: string; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [teamNoteValue, setTeamNoteValue] = useState('');

  useEffect(() => {
    setTeamNoteValue(schedule?.team_note || '');
  }, [schedule?.team_note]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach(s => {
      const key = `${s.staff_member_id}|${s.shift_date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [shifts]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || over.data.current?.kind !== 'cell') return;

    const cellData = over.data.current as { staffId: string; date: string };
    const src = active.data.current;

    setBusy(true);
    try {
      const sched = schedule || await ensureScheduleForWeek(weekStartStr);

      if (src?.kind === 'template') {
        const tpl = src.template as ShiftTemplate;
        await createShift({
          weekly_schedule_id: sched.id,
          staff_member_id: cellData.staffId,
          shift_date: cellData.date,
          start_time: tpl.start_time,
          end_time: tpl.end_time,
          ends_with_closing: tpl.ends_with_closing,
          shift_type: 'work',
          template_id: tpl.id,
          color: tpl.color,
        });
      } else if (src?.kind === 'absence') {
        const abs = src.absence as { type: ShiftType; color: string };
        await createShift({
          weekly_schedule_id: sched.id,
          staff_member_id: cellData.staffId,
          shift_date: cellData.date,
          shift_type: abs.type,
          color: abs.color,
        });
      } else if (src?.kind === 'shift') {
        const s = src.shift as Shift;
        await updateShift(s.id, {
          staff_member_id: cellData.staffId,
          shift_date: cellData.date,
        });
      }
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!schedule) {
      const created = await ensureScheduleForWeek(weekStartStr);
      await publishSchedule(created.id);
    } else {
      await publishSchedule(schedule.id);
    }
    await refetch();
  };

  const handleUnpublish = async () => {
    if (schedule) {
      await unpublishSchedule(schedule.id);
      await refetch();
    }
  };

  const handleDuplicate = async () => {
    const prev = formatDate(addDays(weekStart, -7));
    setBusy(true);
    try {
      await duplicateWeek(prev, weekStartStr);
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTeamNote = async () => {
    if (!schedule) {
      const created = await ensureScheduleForWeek(weekStartStr);
      await updateTeamNote(created.id, teamNoteValue.trim() || null);
    } else {
      await updateTeamNote(schedule.id, teamNoteValue.trim() || null);
    }
    await refetch();
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dienstplan</h1>
          <div className={styles.weekNav}>
            <button className={styles.navButton} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
            <span className={styles.weekLabel}>{formatWeekLabel(weekStart)}</span>
            <button className={styles.navButton} onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
            <button className={styles.navButton} onClick={() => setWeekStart(getMondayOf(new Date()))}>Heute</button>
          </div>
          <span className={`${styles.statusBadge} ${schedule?.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
            {schedule?.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
          </span>
          <div className={styles.headerActions}>
            <button className={styles.btn} onClick={handleDuplicate} disabled={busy}>Vorwoche duplizieren</button>
            {schedule?.status === 'published' ? (
              <button className={styles.btn} onClick={handleUnpublish}>Als Entwurf</button>
            ) : (
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePublish}>Veröffentlichen</button>
            )}
          </div>
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <p className={styles.sidebarTitle}>Schichtvorlagen</p>
            <div className={styles.templateList}>
              {templates.map(t => <DraggableTemplate key={t.id} tpl={t} />)}
            </div>
            <div className={styles.absenceTypes}>
              <p className={styles.sidebarTitle}>Abwesenheit</p>
              <div className={styles.templateList}>
                {ABSENCE_PRESETS.map(a => <DraggableAbsence key={a.type} preset={a} />)}
              </div>
            </div>
          </aside>

          <div className={styles.grid}>
            <div className={styles.gridInner}>
              <div className={styles.gridHeader}>Mitarbeiter</div>
              {weekDates.map((d, i) => (
                <div key={i} className={styles.gridHeader}>
                  {DAY_NAMES[i]}
                  <div className={styles.gridHeaderDate}>
                    {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}
                  </div>
                </div>
              ))}

              {staff.map((sm: StaffMember) => (
                <>
                  <div key={`${sm.id}-name`} className={styles.gridStaffName}>{sm.display_name}</div>
                  {weekDates.map((d) => {
                    const key = `${sm.id}|${formatDate(d)}`;
                    const cellShifts = shiftsByCell.get(key) || [];
                    return (
                      <Cell
                        key={`${sm.id}-${formatDate(d)}`}
                        staffId={sm.id}
                        date={d}
                        shifts={cellShifts}
                        onCellClick={() => setCreatingShift({
                          staffId: sm.id,
                          staffName: sm.display_name,
                          date: formatDate(d),
                        })}
                        onShiftClick={(s) => setEditShift(s)}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.teamNoteBox}>
          <label className={styles.teamNoteLabel}>📌 Team-Hinweis für diese Woche:</label>
          <input
            type="text"
            className={styles.teamNoteInput}
            value={teamNoteValue}
            onChange={(e) => setTeamNoteValue(e.target.value)}
            onBlur={handleSaveTeamNote}
            placeholder="z.B. Am Freitag um 18:30 Uhr gemeinsames Abendessen"
          />
        </div>

        {editShift && (
          <ShiftEditor
            shift={editShift}
            onSave={async (updates) => {
              await updateShift(editShift.id, updates);
              await refetch();
            }}
            onDelete={async () => {
              await deleteShift(editShift.id);
              setEditShift(null);
              await refetch();
            }}
            onClose={() => setEditShift(null)}
          />
        )}

        {creatingShift && (
          <CreateShiftDialog
            staffId={creatingShift.staffId}
            staffName={creatingShift.staffName}
            date={creatingShift.date}
            onSave={async (input) => {
              const sched = schedule || await ensureScheduleForWeek(weekStartStr);
              await createShift({
                weekly_schedule_id: sched.id,
                staff_member_id: creatingShift.staffId,
                shift_date: creatingShift.date,
                ...input,
              });
              await refetch();
            }}
            onClose={() => setCreatingShift(null)}
          />
        )}
      </div>
    </DndContext>
  );
}

// =====================================================
// MFA-Read-only-View
// =====================================================
function MfaDienstplan() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const weekStartStr = formatDate(weekStart);
  const { schedule, shifts, loading } = useOwnWeeklyShifts(user?.id || null, weekStartStr);

  const weekDates = getWeekDates(weekStart);
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach(s => {
      if (!map.has(s.shift_date)) map.set(s.shift_date, []);
      map.get(s.shift_date)!.push(s);
    });
    return map;
  }, [shifts]);

  return (
    <div className={styles.mfaContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mein Dienstplan</h1>
        <div className={styles.weekNav}>
          <button className={styles.navButton} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <span className={styles.weekLabel}>{formatWeekLabel(weekStart)}</span>
          <button className={styles.navButton} onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Lade...</div>
      ) : !schedule ? (
        <div className={styles.notPublishedBanner}>
          Für diese Woche wurde noch kein Dienstplan veröffentlicht.
        </div>
      ) : (
        <>
          {schedule.team_note && (
            <div className={styles.teamNoteBox}>
              <span className={styles.teamNoteLabel}>📌</span>
              {schedule.team_note}
            </div>
          )}

          {weekDates.map((d, i) => {
            const ds = formatDate(d);
            const dayShifts = shiftsByDate.get(ds) || [];
            return (
              <div key={ds} className={styles.mfaDayCard}>
                <div className={styles.mfaDayHeader}>
                  <span className={styles.mfaDayName}>
                    {['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][i]}
                  </span>
                  <span className={styles.mfaDayDate}>
                    {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}.{d.getFullYear()}
                  </span>
                </div>
                {dayShifts.length === 0 ? (
                  <div className={styles.mfaEmpty}>Kein Eintrag</div>
                ) : (
                  dayShifts.map(s => {
                    const bgClass =
                      s.shift_type === 'vacation' ? styles.mfaShiftVacation :
                      s.shift_type === 'sick' ? styles.mfaShiftSick :
                      s.shift_type === 'off' ? styles.mfaShiftOff : styles.mfaShiftWork;
                    return (
                      <div key={s.id} className={`${styles.mfaShift} ${bgClass}`}>
                        {s.shift_type === 'work' && (
                          <div className={styles.mfaShiftColor} style={{ background: s.color || '#2674BB' }} />
                        )}
                        <span className={styles.mfaShiftTime}>
                          {s.shift_type === 'work' ? formatShiftRange(s) :
                           s.shift_type === 'vacation' ? 'Urlaub' :
                           s.shift_type === 'sick' ? 'Krank' : 'Frei'}
                        </span>
                        {s.note && <span className={styles.mfaShiftNote}>{s.note}</span>}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// =====================================================
// Main (role-aware)
// =====================================================
export function DienstplanPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDienstplan /> : <MfaDienstplan />;
}
