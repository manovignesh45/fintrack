import type { QuickNote, QuickNoteInput, TransactionFormData } from './types';

/** A whole line that is just a date, e.g. `12/11/2026`, `13/11/26`, `14-11`. Day first. */
const DATE_LINE = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/;
const NUMBER = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
const ONLY_AMOUNT = new RegExp(String.raw`^(?:₹|rs\.?)?\s*` + NUMBER + String.raw`\s*(?:/-|rs\.?|₹)?$`, 'i');
/** `Maligai 85`, `Tea - ₹20`, `Auto: Rs. 60/-`. The amount must be set off from the name. */
const TRAILING_AMOUNT = new RegExp(
  String.raw`^(.*?)(?:[\s:=\-–]+(?:₹|\brs\.?)?\s*|₹\s*)` + NUMBER + String.raw`\s*(?:/-|rs\.?|₹)?$`,
  'i',
);
/** `85 Maligai`, `₹20 tea` */
const LEADING_AMOUNT = new RegExp(String.raw`^(?:₹|rs\.?)?\s*` + NUMBER + String.raw`\s*(?:/-)?[\s:=\-–]+(.*)$`, 'i');

export const QUICK_NOTE_TITLE_MAX = 255;
export const QUICK_NOTE_AMOUNT_MAX = 9999999999.99;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local calendar date as `YYYY-MM-DD`. */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateLine(line: string, today: string): string | null {
  const m = DATE_LINE.exec(line);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = m[3] ? parseInt(m[3], 10) : parseInt(today.slice(0, 4), 10);
  if (m[3] && m[3].length === 2) year += 2000;
  const d = new Date(year, month - 1, day);
  // Rejects impossible dates such as 31/02, which Date would roll forward.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

/**
 * Parses one jotted line into a title and amount. The amount is the number at
 * the end of the line (or at the start, if the line does not end in one).
 * A line with no amount is kept with amount 0 so it can be filled in later.
 * Returns null when the line has no usable title.
 */
export function parseQuickNoteLine(line: string): { title: string; amount: number } | null {
  const text = line.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  if (ONLY_AMOUNT.test(text)) return null; // just a number, nothing to call it

  let title = text;
  let amount = 0;
  const trailing = TRAILING_AMOUNT.exec(text);
  const leading = trailing ? null : LEADING_AMOUNT.exec(text);
  if (trailing) {
    title = trailing[1].trim();
    amount = toAmount(trailing[2]);
  } else if (leading) {
    title = leading[2].trim();
    amount = toAmount(leading[1]);
  }

  if (!/\p{L}/u.test(title)) return null; // needs at least one letter, in any script
  if (title.length > QUICK_NOTE_TITLE_MAX || !(amount >= 0) || amount > QUICK_NOTE_AMOUNT_MAX) return null;
  return { title, amount };
}

export interface ParsedQuickNotes {
  notes: QuickNoteInput[];
  /** Non-empty lines that could not be read as a date or a note. */
  skipped: string[];
}

/**
 * Parses pasted free text (for example a phone note) into quick notes.
 * A line holding only a date (`13/11/26`, day first) applies to the lines
 * below it; lines before any date use `today`.
 */
export function parseQuickNotes(text: string, today: string = localDateString()): ParsedQuickNotes {
  const notes: QuickNoteInput[] = [];
  const skipped: string[] = [];
  let date = today;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (DATE_LINE.test(line)) {
      const parsed = parseDateLine(line, today);
      if (parsed) date = parsed;
      else skipped.push(line);
      continue;
    }
    const note = parseQuickNoteLine(line);
    if (note) notes.push({ ...note, note_date: date });
    else skipped.push(line);
  }
  return { notes, skipped };
}

/** True when a note can become a transaction in one tap, with no form. */
export function canQuickConvert(note: QuickNote): boolean {
  return note.amount > 0 && !!note.suggestion;
}

/** The transaction a note becomes when confirmed in one tap. Requires `canQuickConvert`. */
export function quickNoteToTransaction(note: QuickNote) {
  const s = note.suggestion!;
  return {
    title: note.title,
    amount: note.amount,
    nature: s.nature,
    source_account_id: s.source_account_id,
    sub_category_id: s.sub_category_id,
    payment_method_id: s.nature === 'EXPENSE' ? s.payment_method_id : undefined,
    principal_amount: 0,
    interest_amount: 0,
    transaction_date: note.note_date,
    quick_note_id: note.id,
  };
}

/** Pre-fills the full transaction form from a note, using its remembered classification if any. */
export function quickNoteToForm(note: QuickNote): TransactionFormData {
  const s = note.suggestion;
  return {
    title: note.title,
    amount: note.amount > 0 ? note.amount.toString() : '',
    nature: s?.nature ?? 'EXPENSE',
    source_account_id: s ? s.source_account_id.toString() : '',
    target_account_id: '',
    sub_category_id: s?.sub_category_id ? s.sub_category_id.toString() : '',
    payment_method_id: s?.nature === 'EXPENSE' && s.payment_method_id ? s.payment_method_id.toString() : '',
    notes: '',
    principal_amount: '0',
    interest_amount: '0',
    transaction_date: note.note_date,
    warranty_until: '',
    warranty_notes: '',
    tag_ids: [],
  };
}

export interface QuickNoteGroup {
  date: string;
  total: number;
  notes: QuickNote[];
}

/** Groups notes by date, newest date first. */
export function groupQuickNotesByDate(notes: QuickNote[]): QuickNoteGroup[] {
  const groups = new Map<string, QuickNoteGroup>();
  for (const n of notes) {
    let g = groups.get(n.note_date);
    if (!g) {
      g = { date: n.note_date, total: 0, notes: [] };
      groups.set(n.note_date, g);
    }
    g.total += n.amount;
    g.notes.push(n);
  }
  return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** `2026-11-13` → `Fri, 13 Nov 2026`; today and yesterday are named. */
export function formatQuickNoteDate(date: string, today: string = localDateString()): string {
  if (date === today) return 'Today';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const t = new Date(today + 'T00:00:00');
  t.setDate(t.getDate() - 1);
  if (localDateString(t) === date) return 'Yesterday';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]}, ${d} ${months[m - 1]} ${y}`;
}
