import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type {
  ShiftTemplate,
  WeeklySchedule,
  Shift,
  StaffMember,
  ShiftType,
} from '../../types/database';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Montag der Woche, in der das Datum liegt (0=So, 1=Mo, ..., 6=Sa) */
export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Alle 6 Tage (Mo-Sa) der Woche ab week_start_date */
export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
}

// =====================================================
// Hook: Schichtvorlagen
// =====================================================
export function useShiftTemplates() {
  const [data, setData] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: templates } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setData(templates || []);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch };
}

// =====================================================
// Hook: MFA-Staff-Liste
// =====================================================
export function useMfaStaff() {
  const [data, setData] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: staff } = await supabase
        .from('admin_profiles')
        .select('id, display_name, role, is_active')
        .eq('role', 'mfa')
        .eq('is_active', true)
        .order('display_name');
      setData(staff || []);
      setLoading(false);
    }
    load();
  }, []);

  return { data, loading };
}

// =====================================================
// Hook: Wochenplan + Schichten laden
// =====================================================
export interface WeeklyScheduleData {
  schedule: WeeklySchedule | null;
  shifts: Shift[];
  loading: boolean;
}

export function useWeeklySchedule(weekStartDate: string) {
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: scheduleRow } = await supabase
      .from('weekly_schedules')
      .select('*')
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    setSchedule(scheduleRow);

    if (scheduleRow) {
      const { data: shiftRows } = await supabase
        .from('shifts')
        .select('*')
        .eq('weekly_schedule_id', scheduleRow.id)
        .order('shift_date')
        .order('start_time');
      setShifts(shiftRows || []);
    } else {
      setShifts([]);
    }
    setLoading(false);
  }, [weekStartDate]);

  useEffect(() => { refetch(); }, [refetch]);

  return { schedule, shifts, loading, refetch };
}

// =====================================================
// Aktionen: Schedule anlegen / publizieren / duplizieren
// =====================================================
export async function ensureScheduleForWeek(weekStartDate: string): Promise<WeeklySchedule> {
  const { data: existing } = await supabase
    .from('weekly_schedules')
    .select('*')
    .eq('week_start_date', weekStartDate)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('weekly_schedules')
    .insert({ week_start_date: weekStartDate, status: 'draft' })
    .select()
    .single();
  if (error || !created) throw error;
  return created;
}

export async function publishSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('weekly_schedules')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', scheduleId);
  if (error) throw error;
}

export async function unpublishSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('weekly_schedules')
    .update({ status: 'draft', published_at: null })
    .eq('id', scheduleId);
  if (error) throw error;
}

export async function updateTeamNote(scheduleId: string, note: string | null): Promise<void> {
  const { error } = await supabase
    .from('weekly_schedules')
    .update({ team_note: note })
    .eq('id', scheduleId);
  if (error) throw error;
}

/** Dupliziere alle Schichten einer Vorwoche auf eine neue Zielwoche */
export async function duplicateWeek(
  sourceWeekStartDate: string,
  targetWeekStartDate: string,
): Promise<void> {
  const { data: sourceSchedule } = await supabase
    .from('weekly_schedules')
    .select('id')
    .eq('week_start_date', sourceWeekStartDate)
    .maybeSingle();
  if (!sourceSchedule) return;

  const { data: sourceShifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('weekly_schedule_id', sourceSchedule.id);
  if (!sourceShifts || sourceShifts.length === 0) return;

  const target = await ensureScheduleForWeek(targetWeekStartDate);

  const srcStart = new Date(sourceWeekStartDate);
  const tgtStart = new Date(targetWeekStartDate);
  const offsetDays = Math.round((tgtStart.getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));

  const newRows = sourceShifts.map(s => {
    const newDate = addDays(new Date(s.shift_date), offsetDays);
    return {
      weekly_schedule_id: target.id,
      staff_member_id: s.staff_member_id,
      shift_date: formatDate(newDate),
      start_time: s.start_time,
      end_time: s.end_time,
      ends_with_closing: s.ends_with_closing,
      shift_type: s.shift_type,
      note: s.note,
      template_id: s.template_id,
      color: s.color,
    };
  });

  const { error } = await supabase.from('shifts').insert(newRows);
  if (error) throw error;
}

// =====================================================
// Aktionen: Einzelne Schicht
// =====================================================
export interface CreateShiftInput {
  weekly_schedule_id: string;
  staff_member_id: string;
  shift_date: string;
  start_time?: string | null;
  end_time?: string | null;
  ends_with_closing?: boolean;
  shift_type?: ShiftType;
  note?: string | null;
  template_id?: string | null;
  color?: string | null;
}

export async function createShift(input: CreateShiftInput): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      ...input,
      shift_type: input.shift_type ?? 'work',
      ends_with_closing: input.ends_with_closing ?? false,
    })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function updateShift(
  id: string,
  updates: Partial<Omit<Shift, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase.from('shifts').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================
// Helper: Schedule für eigene MFA (read-only)
// =====================================================
export function useOwnWeeklyShifts(userId: string | null, weekStartDate: string) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      const { data: scheduleRow } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('week_start_date', weekStartDate)
        .eq('status', 'published')
        .maybeSingle();

      if (scheduleRow) {
        setSchedule(scheduleRow);
        const { data: shiftRows } = await supabase
          .from('shifts')
          .select('*')
          .eq('weekly_schedule_id', scheduleRow.id)
          .eq('staff_member_id', userId)
          .order('shift_date')
          .order('start_time');
        setShifts(shiftRows || []);
      } else {
        setSchedule(null);
        setShifts([]);
      }
      setLoading(false);
    }
    load();
  }, [userId, weekStartDate]);

  return { schedule, shifts, loading };
}

// Export helpers
export { formatDate };
