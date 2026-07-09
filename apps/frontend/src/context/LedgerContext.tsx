import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Ledger } from '@fintrack/shared';
import { ledgersApi } from '../api/client';
import { useAuth } from './AuthContext';

interface LedgerContextType {
  ledgers: Ledger[];
  activeLedgerId: string | null;
  activeLedger: Ledger | null;
  switchLedger: (id: string) => void;
  createLedger: (name: string) => Promise<void>;
  loading: boolean;
  refreshLedgers: () => Promise<void>;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [activeLedgerId, setActiveLedgerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshLedgers = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await ledgersApi.list();
      setLedgers(data || []);
      
      const savedId = localStorage.getItem('fintrack_ledger_id');
      if (data && data.length > 0) {
        if (savedId && data.some(l => l.id.toString() === savedId)) {
          setActiveLedgerId(savedId);
        } else {
          const defaultId = data[0].id.toString();
          setActiveLedgerId(defaultId);
          localStorage.setItem('fintrack_ledger_id', defaultId);
        }
      } else {
        setActiveLedgerId(null);
        localStorage.removeItem('fintrack_ledger_id');
      }
    } catch (error) {
      console.error('Failed to fetch ledgers', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshLedgers();
  }, [refreshLedgers]);

  const switchLedger = (id: string) => {
    setActiveLedgerId(id);
    localStorage.setItem('fintrack_ledger_id', id);
    // Reload the page to reset all context and caches since ledgers are strictly isolated
    window.location.reload();
  };

  const createLedger = async (name: string) => {
    const newLedger = await ledgersApi.create({ name });
    await refreshLedgers();
    switchLedger(newLedger.id.toString());
  };

  const activeLedger = ledgers.find(l => l.id.toString() === activeLedgerId) || null;

  return (
    <LedgerContext.Provider
      value={{
        ledgers,
        activeLedgerId,
        activeLedger,
        switchLedger,
        createLedger,
        loading,
        refreshLedgers,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedgers = () => {
  const context = useContext(LedgerContext);
  if (context === undefined) {
    throw new Error('useLedgers must be used within a LedgerProvider');
  }
  return context;
};
