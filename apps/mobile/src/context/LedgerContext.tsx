import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Ledger } from '@fintrack/shared';
import { ledgersApi, setApiLedgerId } from '@/src/api/client';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LedgerContextType {
  ledgers: Ledger[];
  activeLedgerId: string | null;
  activeLedger: Ledger | null;
  switchLedger: (id: string) => Promise<void>;
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
      
      const savedId = await AsyncStorage.getItem('fintrack_ledger_id');
      if (data && data.length > 0) {
        if (savedId && data.some(l => l.id.toString() === savedId)) {
          setActiveLedgerId(savedId);
          setApiLedgerId(savedId);
        } else {
          const defaultId = data[0].id.toString();
          setActiveLedgerId(defaultId);
          setApiLedgerId(defaultId);
          await AsyncStorage.setItem('fintrack_ledger_id', defaultId);
        }
      } else {
        setActiveLedgerId(null);
        setApiLedgerId(null);
        await AsyncStorage.removeItem('fintrack_ledger_id');
      }
    } catch (error) {
      console.error('Failed to fetch ledgers', error);
      if (!activeLedgerId) {
        const savedId = await AsyncStorage.getItem('fintrack_ledger_id');
        if (savedId) {
          setActiveLedgerId(savedId);
          setApiLedgerId(savedId);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshLedgers();
  }, [refreshLedgers]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLedgers([]);
      setActiveLedgerId(null);
    }
  }, [isAuthenticated]);

  const switchLedger = async (id: string) => {
    setActiveLedgerId(id);
    setApiLedgerId(id);
    await AsyncStorage.setItem('fintrack_ledger_id', id);
    // Trigger a full app reload or navigation reset if possible, 
    // for now resetting the state and forcing a new network sync handles it
  };

  const createLedger = async (name: string) => {
    const newLedger = await ledgersApi.create({ name });
    await refreshLedgers();
    await switchLedger(newLedger.id.toString());
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
