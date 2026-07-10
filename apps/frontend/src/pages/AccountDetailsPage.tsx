import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { accountsApi, transactionsApi, paymentMethodsApi } from '../api/client';
import type { Account, Transaction, PaymentMethod } from '../api/types';

export default function AccountDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [period, setPeriod] = useState<'month' | 'all'>('all');

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        let accountCurr, accountAtStart, txnData;

        if (period === 'month') {
          const [year, monthNum] = month.split('-').map(Number);
          const dateFrom = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
          const dateTo = new Date(year, monthNum, 0).toISOString().split('T')[0];
          const dayBeforeStart = new Date(year, monthNum - 1, 0).toISOString().split('T')[0];

          [accountCurr, accountAtStart, txnData, ,] = await Promise.all([
            accountsApi.get(parseInt(id), { date_to: dateTo }),
            accountsApi.get(parseInt(id), { date_to: dayBeforeStart }),
            transactionsApi.list({ 
              account_id: id, 
              date_from: dateFrom, 
              date_to: dateTo,
              per_page: "100" 
            }),
            paymentMethodsApi.list().then(setPaymentMethods),
          ]);
        } else {
          [accountCurr, txnData, ,] = await Promise.all([
            accountsApi.get(parseInt(id)),
            transactionsApi.list({ 
              account_id: id, 
              per_page: "1000"
            }),
            paymentMethodsApi.list().then(setPaymentMethods),
          ]);
          // For all time, the opening balance is the initial balance
          accountAtStart = { ...accountCurr, current_balance: accountCurr.initial_balance };
        }

        setAccount(accountCurr);
        setOpeningBalanceAccount(accountAtStart);
        setTransactions(txnData || []);
      } catch (err) {
        alert('Failed to load account details');
        navigate('/accounts');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate, month, period]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header placeholder */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/accounts')} className="text-gray-600 dark:text-gray-400 text-xl">←</button>
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
        </div>
        <p className="text-gray-400 text-center py-8">Loading...</p>
      </div>
    );
  }

  if (!account || !openingBalanceAccount) {
    return null;
  }

  // Use the opening balance from openingBalanceAccount
  const statementRows = calculateStatement(transactions, openingBalanceAccount.current_balance, account.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/accounts')}
            className="text-gray-600 dark:text-gray-400 text-xl"
          >
            ←
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{account.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{account.type}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'month' | 'all')}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
          >
            <option value="all">All Time</option>
            <option value="month">Monthly</option>
          </select>
          {period === 'month' && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
            />
          )}
        </div>
      </div>

      {/* Current Balance Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs opacity-90 uppercase font-semibold">
              Closing Balance {period === 'month' ? `(${new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})` : ''}
            </p>
            <p className="text-3xl font-bold mt-1">
              ₹{account.current_balance.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">Opening Balance</p>
            <p className="text-lg font-semibold">₹{openingBalanceAccount.current_balance.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Statement */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Account Statement</h3>
        </div>

        {statementRows.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No transactions found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Debit</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Credit</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Transactions */}
                {statementRows.map((row) => (
                  <tr key={row.txn.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(row.txn.transaction_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{row.txn.title}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            row.txn.nature === 'INCOME' ? 'bg-green-100 text-green-700' :
                            row.txn.nature === 'EXPENSE' ? 'bg-red-100 text-red-700' :
                            row.txn.nature === 'TRANSFER' ? 'bg-blue-100 text-blue-700' :
                            row.txn.nature === 'LOAN_DISBURSEMENT' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {row.txn.nature === 'EMI_PAYMENT' ? 'EMI' : row.txn.nature === 'LOAN_DISBURSEMENT' ? 'LOAN' : row.txn.nature}
                          </span>
                          {row.txn.payment_method_id && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{paymentMethods.find(p => p.id === row.txn.payment_method_id)?.name || `Payment #${row.txn.payment_method_id}`}</span>
                          )}
                        </div>
                        {row.txn.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{row.txn.notes}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.debit > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          ₹{row.debit.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.interest > 0 && (
                        <span className="text-orange-600 font-medium">
                          ₹{row.interest.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.credit > 0 && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ₹{row.credit.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      ₹{row.balance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {/* Opening Balance - at the bottom since transactions are newest first */}
                <tr className="border-t-2 border-blue-200 bg-blue-50 dark:bg-blue-900/30">
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">—</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300 underline decoration-dotted">Balance Brought Forward</span>
                  </td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                    ₹{openingBalanceAccount.current_balance.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatementRow {
  txn: Transaction;
  debit: number;
  credit: number;
  interest: number;
  balance: number;
}

function calculateStatement(
  transactions: Transaction[],
  initialBalance: number,
  accountId: number
): StatementRow[] {
  if (transactions.length === 0) return [];

  // Sort transactions by date (oldest first) for running balance calculation
  const sorted = [...transactions].sort((a, b) => {
    const dateCompare = a.transaction_date.localeCompare(b.transaction_date);
    if (dateCompare !== 0) return dateCompare;
    return a.id - b.id;
  });

  let runningBalance = initialBalance;
  const rows: StatementRow[] = [];

  for (const txn of sorted) {
    let debit = 0;
    let credit = 0;
    let interest = 0;

    const isSource = txn.source_account_id === accountId;
    const isTarget = txn.target_account_id === accountId;

    if (txn.nature === 'INCOME') {
      // Money coming into the account
      if (isSource || isTarget) {
        credit = txn.amount;
        runningBalance += txn.amount;
      }
    } else if (txn.nature === 'EXPENSE') {
      // Money going out of the account
      if (isSource) {
        debit = txn.amount;
        runningBalance -= txn.amount;
      }
    } else if (txn.nature === 'TRANSFER') {
      // For transfers, check if we're source (money out) or target (money in)
      if (isSource) {
        debit = txn.amount;
        runningBalance -= txn.amount;
      } else if (isTarget) {
        credit = txn.amount;
        runningBalance += txn.amount;
      }
    } else if (txn.nature === 'EMI_PAYMENT') {
      // EMI payment
      if (isSource) {
        // Paying from asset account - money out
        debit = txn.amount;
        runningBalance -= txn.amount;
      } else if (isTarget) {
        // Liability account receiving payment - principal reduces the loan
        // Show principal in debit column (loan reduces) and balance decreases
        debit = txn.principal_amount;
        interest = txn.interest_amount;
        runningBalance -= txn.principal_amount;
      }
    } else if (txn.nature === 'LOAN_DISBURSEMENT') {
      // New loan disbursement
      if (isSource) {
        // Loan account (source) - debt increases
        credit = txn.amount;
        runningBalance += txn.amount;
      } else if (isTarget) {
        // Bank account (target) - money received
        credit = txn.amount;
        runningBalance += txn.amount;
      }
    }

    rows.push({ txn, debit, credit, interest, balance: runningBalance });
  }

  // Reverse to show newest first
  return rows.reverse();
}
