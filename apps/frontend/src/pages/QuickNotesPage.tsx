import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  parseQuickNoteLine,
  parseQuickNotes,
  canQuickConvert,
  quickNoteToTransaction,
  groupQuickNotesByDate,
  formatQuickNoteDate,
  localDateString,
} from '@fintrack/shared';
import { quickNotesApi, transactionsApi } from '../api/client';
import type { QuickNote, QuickNoteInput } from '../api/types';
import { invalidateCache, useCachedList } from '../hooks/useCachedList';
import ConfirmModal from '../components/ConfirmModal';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function suggestionLabel(note: QuickNote): string | null {
  const s = note.suggestion;
  if (!s) return null;
  const parts = [s.category_name, s.sub_category_name].filter(Boolean).join(' › ');
  const label = parts || (s.nature === 'INCOME' ? 'Income' : 'Expense');
  return s.payment_method_name && s.nature === 'EXPENSE' ? `${label} · ${s.payment_method_name}` : label;
}

export default function QuickNotesPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const today = localDateString();
  const [text, setText] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<QuickNote | null>(null);

  const { data: notes, setData: setNotes, loading, reload } = useCachedList<QuickNote[]>(
    'quick-notes',
    () => quickNotesApi.list(),
    []
  );

  const groups = useMemo(() => groupQuickNotesByDate(notes), [notes]);
  const total = notes.reduce((sum, n) => sum + n.amount, 0);
  const parsedPaste = useMemo(() => parseQuickNotes(pasteText ?? '', today), [pasteText, today]);
  const pasteTotal = parsedPaste.notes.reduce((sum, n) => sum + n.amount, 0);

  /** Saves notes and shows the refreshed list. Returns false (with an error shown) on failure. */
  const save = async (batch: QuickNoteInput[]) => {
    setSaving(true);
    setError('');
    try {
      // A client_id lets a retried request be recognised instead of saved twice.
      const saved = await quickNotesApi.create(batch.map((n) => ({ ...n, client_id: crypto.randomUUID() })));
      setNotes(saved);
      invalidateCache('quick-notes');
      return true;
    } catch (err) {
      setError(err instanceof Error ? `Not saved: ${err.message}` : 'Not saved. Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const note = parseQuickNoteLine(text);
    if (!note) {
      setError(text.trim() ? 'Add a name with the amount, e.g. "Maligai 85"' : '');
      return;
    }
    // The text stays in the box until the server confirms, so a failed save loses nothing.
    if (await save([{ ...note, note_date: date }])) setText('');
    inputRef.current?.focus();
  };

  const handlePasteSave = async () => {
    if (await save(parsedPaste.notes)) setPasteText(null);
  };

  const handleConfirm = async (note: QuickNote) => {
    setBusyId(note.id);
    setError('');
    try {
      await transactionsApi.create(quickNoteToTransaction(note));
      setNotes(notes.filter((n) => n.id !== note.id));
      invalidateCache('quick-notes');
      invalidateCache('transaction');
      invalidateCache('summary:');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add transaction');
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const note = toDelete;
    setBusyId(note.id);
    try {
      await quickNotesApi.delete(note.id);
      setNotes(notes.filter((n) => n.id !== note.id));
      invalidateCache('quick-notes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete note');
      reload();
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <Link to="/" className="text-lg font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">Transactions</Link>
          <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</span>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Quick Notes</h2>
        </div>
        <button
          type="button"
          onClick={() => setPasteText(pasteText === null ? '' : null)}
          className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
        >
          📋 Paste list
        </button>
      </div>

      {/* Capture bar: type "name amount", press Enter, repeat. */}
      <form onSubmit={handleCapture} className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={text}
            onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
            onPaste={(e) => {
              // A multi-line paste is a whole list, not one note.
              const pasted = e.clipboardData.getData('text');
              if (pasted.includes('\n')) {
                e.preventDefault();
                setPasteText(pasted);
              }
            }}
            placeholder="Maligai 85"
            aria-label="Quick note: name and amount"
            className={`flex-1 min-w-0 px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
          />
          <button
            type="submit"
            disabled={!text.trim() || saving}
            className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          {error ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Name, then amount. Sort it into a transaction later.</p>
          )}
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            aria-label="Date for new notes"
            className="shrink-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200"
          />
        </div>
      </form>

      {pasteText !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            One spend per line. A line with only a date (13/11/26) applies to the lines under it.
          </p>
          <textarea
            autoFocus
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder={'13/11/26\nMaligai 85\nGarlic 300'}
            aria-label="Pasted list of notes"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {parsedPaste.notes.length ? `${plural(parsedPaste.notes.length, 'note')} · ${rupees(pasteTotal)}` : 'No notes found yet'}
          </p>
          {parsedPaste.skipped.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Could not read {plural(parsedPaste.skipped.length, 'line')}: {parsedPaste.skipped.join(', ')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPasteText(null)} className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasteSave}
              disabled={parsedPaste.notes.length === 0 || saving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              {parsedPaste.notes.length ? `Add ${plural(parsedPaste.notes.length, 'note')}` : 'Add notes'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-4">Loading...</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-10">
          <p className="font-medium text-gray-500 dark:text-gray-400">Nothing to review</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Jot a spend above the moment it happens. Turn it into a transaction when you have time.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {notes.length} to review · <span className="font-semibold">{rupees(total)}</span> not in your totals yet
          </p>
          {groups.map((group) => (
            <section key={group.date} className="space-y-2">
              <div className="flex justify-between text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                <h3>{formatQuickNoteDate(group.date, today)}</h3>
                <span>{rupees(group.total)}</span>
              </div>
              {group.notes.map((note) => (
                <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => navigate('/add', { state: { quickNote: note } })}
                    className="flex-1 min-w-0 text-left"
                    aria-label={`Add details for ${note.title}`}
                  >
                    <span className="block font-medium text-gray-800 dark:text-gray-200 truncate">{note.title}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{suggestionLabel(note) ?? 'Add details'}</span>
                  </button>
                  <span className={`font-semibold whitespace-nowrap ${note.amount ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {note.amount ? rupees(note.amount) : 'No amount'}
                  </span>
                  {canQuickConvert(note) && (
                    <button
                      type="button"
                      onClick={() => handleConfirm(note)}
                      disabled={busyId !== null}
                      aria-label={`Add ${note.title} as a transaction`}
                      title="Add as a transaction, classified like last time"
                      className="w-8 h-8 shrink-0 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white flex items-center justify-center"
                    >
                      {busyId === note.id ? '…' : '✓'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setToDelete(note)}
                    disabled={busyId !== null}
                    aria-label={`Delete ${note.title}`}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </section>
          ))}
        </>
      )}

      <ConfirmModal
        isOpen={toDelete !== null}
        title="Delete note?"
        message={toDelete ? `${toDelete.title}${toDelete.amount ? ` · ${rupees(toDelete.amount)}` : ''} will be removed without becoming a transaction.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        busy={busyId !== null}
      />
    </div>
  );
}
