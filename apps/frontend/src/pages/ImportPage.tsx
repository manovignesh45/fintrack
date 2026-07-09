import React, { useState } from 'react';
import { importApi } from '../api/client';
import { useLedgers } from '../context/LedgerContext';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { refreshLedgers } = useLedgers();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a CSV file first.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await importApi.uploadCsv(file);
      setMessage({ type: 'success', text: 'Import successful! New Ledgers have been created automatically.' });
      await refreshLedgers();
      setFile(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to import CSV' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Import CSV Data</h2>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Upload your exported FinTrack CSV file. The importer will read the <strong>Entity</strong> column (e.g. HOME, PERSONAL) and automatically construct the appropriate <strong>Ledgers</strong> for you, perfectly restoring your data segregation!
        </p>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 flex flex-col items-center justify-center text-center">
          <input
            type="file"
            accept=".csv"
            id="csv-upload"
            className="hidden"
            onChange={handleFileChange}
          />
          <label
            htmlFor="csv-upload"
            className="cursor-pointer bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            {file ? file.name : 'Select CSV File'}
          </label>
          <p className="mt-2 text-xs text-gray-500">Max size: 10MB</p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Importing...' : 'Start Import'}
        </button>
      </div>
    </div>
  );
}
