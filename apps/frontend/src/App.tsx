import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo } from 'react';
import TransactionsPage from './pages/TransactionsPage';
import AddTransactionPage from './pages/AddTransactionPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailsPage from './pages/AccountDetailsPage';
import CategoriesPage from './pages/CategoriesPage';
import CreateCategoryPage from './pages/CreateCategoryPage';
import CreateSubCategoryPage from './pages/CreateSubCategoryPage';
import SummaryPage from './pages/SummaryPage';
import ChartsPage from './pages/ChartsPage';
import TallyPage from './pages/TallyPage';
import TemplatesPage from './pages/TemplatesPage';
import CreateTemplatePage from './pages/CreateTemplatePage';
import PaymentMethodsPage from './pages/PaymentMethodsPage';
import CommitmentsPage from './pages/CommitmentsPage';
import CommitmentFormPage from './pages/CommitmentFormPage';
import EditTransactionPage from './pages/EditTransactionPage';
import LoginPage from './pages/LoginPage';
import ImportPage from './pages/ImportPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LedgerProvider, useLedgers } from './context/LedgerContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import SuperAdminShell from './components/SuperAdminShell';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useHasCommitments } from './hooks/useHasCommitments';

export interface NavItemConfig {
  to: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

function MorePage() {
  const hasCommitments = useHasCommitments();

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white">More</h2>
      {!hasCommitments && (
        <NavLink to="/commitments" className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
          📆 Monthly Commitments
        </NavLink>
      )}
      <NavLink to="/categories" className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
        📁 Categories & Sub-categories
      </NavLink>
      <NavLink to="/payment-methods" className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
        💳 Payment Methods
      </NavLink>
      <NavLink to="/tally" className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
        ✅ Tally / Reconciliation
      </NavLink>
      <NavLink to="/templates" className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
        📋 Transaction Templates
      </NavLink>
      <NavLink to="/import" className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
        📥 Import CSV
      </NavLink>
    </div>
  );
}

const baseNavItems: NavItemConfig[] = [
  { to: '/', label: 'Transactions', icon: '📋', component: TransactionsPage },
  { to: '/templates', label: 'Templates', icon: '📝', component: TemplatesPage },
  { to: '/accounts', label: 'Loans', icon: '🏦', component: AccountsPage },
  { to: '/summary', label: 'Summary', icon: '📊', component: SummaryPage },
  { to: '/more', label: 'More', icon: '⋯', component: MorePage },
];

const commitmentNavItem: NavItemConfig = {
  to: '/commitments',
  label: 'Commitments',
  icon: '📆',
  component: CommitmentsPage,
};

// Surfaced only in the desktop sidebar, which has room to show everything
// the mobile "More" page keeps tucked away. Excludes Templates since that's
// already a primary nav item.
const moreNavItems = [
  { to: '/commitments', label: 'Monthly Commitments', icon: '📆' },
  { to: '/categories', label: 'Categories & Sub-categories', icon: '📁' },
  { to: '/payment-methods', label: 'Payment Methods', icon: '💳' },
  { to: '/tally', label: 'Tally / Reconciliation', icon: '✅' },
  { to: '/import', label: 'Import CSV', icon: '📥' },
];

const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
  }`;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { loading: ledgerLoading } = useLedgers();
  const location = useLocation();

	if (authLoading) return <div className="flex h-screen items-center justify-center">Loading auth...</div>;
	if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
	if (ledgerLoading) return <div className="flex h-screen items-center justify-center">Loading workspace...</div>;

	return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, loading, user } = useAuth();

	if (loading) return <div>Loading...</div>;
	if (!isAuthenticated || user?.role !== 'superadmin') {
		return <Navigate to="/" replace />;
	}

	return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LedgerProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/superadmin/*" element={<SuperAdminRoute><SuperAdminShell /></SuperAdminRoute>} />
              <Route path="/*" element={<AppShell />} />
            </Routes>
          </ThemeProvider>
        </LedgerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const { isAuthenticated, logout, user, editMode, setEditMode } = useAuth();
  const { theme, setTheme } = useTheme();
  const { ledgers, activeLedger, switchLedger, createLedger } = useLedgers();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLedgerDropdown, setShowLedgerDropdown] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'theme'>('main');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const ledgerDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const hasCommitments = useHasCommitments();

  const currentNavItems = useMemo<NavItemConfig[]>(() => {
    if (!hasCommitments) return baseNavItems;
    return [
      baseNavItems[0], // Transactions
      baseNavItems[1], // Templates
      commitmentNavItem, // Commitments
      baseNavItems[2], // Loans
      baseNavItems[3], // Summary
      baseNavItems[4], // More
    ];
  }, [hasCommitments]);

  const currentMoreNavItems = useMemo(() => {
    if (hasCommitments) {
      return moreNavItems.filter((i) => i.to !== '/commitments');
    }
    return moreNavItems;
  }, [hasCommitments]);

  const navPaths = useMemo(() => currentNavItems.map((item) => item.to), [currentNavItems]);
  const isTabRoute = navPaths.includes(location.pathname);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setTimeout(() => setMenuView('main'), 200);
      }
      if (ledgerDropdownRef.current && !ledgerDropdownRef.current.contains(e.target as Node)) {
        setShowLedgerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="h-dvh flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-900 transition-colors">
      {isAuthenticated && (
        <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-colors">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white leading-none">FinTrack</h2>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {currentNavItems.filter((item) => item.to !== '/more').map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={sidebarLinkClass}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.to === '/commitments' ? 'Monthly Commitments' : item.label}</span>
              </NavLink>
            ))}
            <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-1">
              More
            </div>
            {currentMoreNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={sidebarLinkClass}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
      )}
      <div className="flex-1 min-h-0 flex flex-col">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0 z-10 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2 relative" ref={ledgerDropdownRef}>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white leading-none">FinTrack</h1>
          {isAuthenticated && activeLedger && (
            <button
              onClick={() => setShowLedgerDropdown((v) => !v)}
              className="px-2 py-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 rounded-full border border-blue-200 dark:border-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
            >
              <span>{activeLedger.name}</span>
              <span className="text-blue-500 dark:text-blue-400">▾</span>
            </button>
          )}
          {showLedgerDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden py-1">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Switch Ledger</p>
              </div>
              {ledgers.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    switchLedger(l.id.toString());
                    setShowLedgerDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex justify-between items-center capitalize"
                >
                  <span className="truncate">{l.name}</span>
                  {activeLedger?.id === l.id && <span className="text-blue-600 dark:text-blue-400 shrink-0">✓</span>}
                </button>
              ))}
              {editMode && (
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowLedgerDropdown(false);
                      setShowCreateModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1"
                  >
                    <span className="text-lg leading-none">+</span>
                    <span>Create Ledger</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {/* Edit mode toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Edit</span>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                  editMode ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                aria-label="Toggle edit mode"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    editMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* User avatar with dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
              >
                {initials}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  {menuView === 'main' && (
                    <>
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                        <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{user?.username}</p>
                      </div>
                      <button
                        onClick={() => setMenuView('theme')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex justify-between items-center"
                      >
                        <span>Theme</span>
                        <span className="text-gray-400">›</span>
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); setMenuView('main'); logout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-gray-700"
                      >
                        Logout
                      </button>
                    </>
                  )}
                  {menuView === 'theme' && (
                    <>
                      <button
                        onClick={() => setMenuView('main')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 flex items-center gap-1"
                      >
                        <span>‹</span>
                        <span>Back</span>
                      </button>
                      {(['light', 'dark', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex justify-between items-center capitalize"
                        >
                          <span>{t}</span>
                          {theme === t && <span className="text-blue-600 dark:text-blue-400">✓</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 relative">
        {isAuthenticated && isTabRoute && !isDesktop ? (
          <SwipeableTabs tabs={currentNavItems} />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-4">
              <Routes>
                <Route path="/" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
                <Route path="/add" element={<ProtectedRoute><AddTransactionPage /></ProtectedRoute>} />
                <Route path="/edit/:id" element={<ProtectedRoute><EditTransactionPage /></ProtectedRoute>} />
                <Route path="/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
                <Route path="/accounts/:id" element={<ProtectedRoute><AccountDetailsPage /></ProtectedRoute>} />
                <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
                <Route path="/categories/new" element={<ProtectedRoute><CreateCategoryPage /></ProtectedRoute>} />
                <Route path="/categories/:catId/sub/new" element={<ProtectedRoute><CreateSubCategoryPage /></ProtectedRoute>} />
                <Route path="/summary" element={<ProtectedRoute><SummaryPage /></ProtectedRoute>} />
                <Route path="/summary/charts" element={<ProtectedRoute><ChartsPage /></ProtectedRoute>} />
                <Route path="/tally" element={<ProtectedRoute><TallyPage /></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
                <Route path="/templates/new" element={<ProtectedRoute><CreateTemplatePage /></ProtectedRoute>} />
                <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
                <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethodsPage /></ProtectedRoute>} />
                <Route path="/commitments" element={<ProtectedRoute><CommitmentsPage /></ProtectedRoute>} />
                <Route path="/commitments/new" element={<ProtectedRoute><CommitmentFormPage /></ProtectedRoute>} />
                <Route path="/commitments/:id/edit" element={<ProtectedRoute><CommitmentFormPage /></ProtectedRoute>} />
                <Route path="/more" element={<ProtectedRoute><MorePage /></ProtectedRoute>} />
              </Routes>
            </div>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <nav className="lg:hidden shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10 transition-colors">
          <div className="max-w-lg mx-auto flex justify-around">
            {currentNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center py-1.5 px-1 sm:px-2 text-[10px] sm:text-xs font-medium transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                  }`
                }
              >
                <span className="text-lg leading-tight">{item.icon}</span>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Create Ledger Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Ledger</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Enter a name for your new workspace (e.g., Office, Vacation).
              </p>
              <input
                type="text"
                autoFocus
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                placeholder="Ledger Name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewLedgerName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newLedgerName.trim()) {
                    try {
                      await createLedger(newLedgerName.trim());
                      setShowCreateModal(false);
                      setNewLedgerName('');
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Failed to create ledger');
                    }
                  }
                }}
                disabled={!newLedgerName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

const SETTLE_TRANSITION = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';

function SwipeableTabs({ tabs }: { tabs: NavItemConfig[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const navPaths = useMemo(() => tabs.map((t) => t.to), [tabs]);
  const activeIndex = navPaths.indexOf(location.pathname);
  const activeIndexRef = useRef(activeIndex);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([Math.max(0, activeIndex)]));
  const slidePct = 100 / tabs.length;

  // Keep the current tab plus its immediate neighbors mounted so a swipe
  // in either direction has something to drag to without a blank frame.
  if (activeIndex >= 0 && !mounted.has(activeIndex)) {
    setMounted((prev) => {
      const next = new Set(prev);
      next.add(activeIndex);
      if (activeIndex > 0) next.add(activeIndex - 1);
      if (activeIndex < tabs.length - 1) next.add(activeIndex + 1);
      return next;
    });
  }

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Settle the track on the active slide whenever the route changes from
  // outside a drag (tab bar tap, browser back/forward). A drag-driven
  // change already sits here, so this just animates external navigation.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || activeIndex < 0) return;
    track.style.transition = SETTLE_TRANSITION;
    track.style.transform = `translateX(-${activeIndex * slidePct}%)`;
  }, [activeIndex, slidePct]);

  // Drag the track 1:1 with the finger; release past a distance/velocity
  // threshold moves exactly one tab, otherwise it springs back. Mirrors a
  // native pager view instead of letting a fast flick sail past several tabs.
  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let containerWidth = 0;
    let dragging = false;
    let axis: 'x' | 'y' | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement)?.closest('[data-no-swipe]')) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      containerWidth = container.clientWidth;
      dragging = true;
      axis = null;
      track.style.transition = 'none';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') {
          dragging = false;
          return;
        }
      }

      e.preventDefault();
      const index = activeIndexRef.current;
      const dragPct = (dx / containerWidth) * slidePct;
      let offsetPct = index * slidePct - dragPct;
      const maxPct = (tabs.length - 1) * slidePct;
      if (offsetPct < 0) offsetPct *= 0.35; // rubber-band past the first tab
      if (offsetPct > maxPct) offsetPct = maxPct + (offsetPct - maxPct) * 0.35; // and the last
      track.style.transform = `translateX(-${offsetPct}%)`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      if (axis !== 'x') return;

      const dx = e.changedTouches[0].clientX - startX;
      const elapsed = Date.now() - startTime;
      const velocity = Math.abs(dx) / Math.max(elapsed, 1);
      const index = activeIndexRef.current;

      let nextIndex = index;
      if (Math.abs(dx) > containerWidth * 0.2 || velocity > 0.5) {
        if (dx < 0 && index < tabs.length - 1) nextIndex = index + 1;
        else if (dx > 0 && index > 0) nextIndex = index - 1;
      }

      track.style.transition = SETTLE_TRANSITION;
      track.style.transform = `translateX(-${nextIndex * slidePct}%)`;
      if (nextIndex !== index && nextIndex >= 0 && nextIndex < navPaths.length) {
        navigate(navPaths[nextIndex]);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [navigate, navPaths, slidePct, tabs.length]);

  return (
    <ProtectedRoute>
      <div ref={containerRef} className="h-full w-full overflow-hidden">
        <div
          ref={trackRef}
          className="h-full flex"
          style={{ width: `${tabs.length * 100}%`, transform: `translateX(-${Math.max(0, activeIndex) * slidePct}%)` }}
        >
          {tabs.map((tab, index) => {
            const Page = tab.component;
            return (
              <div key={tab.to} className="h-full shrink-0 relative" style={{ width: `${slidePct}%` }}>
                <div className="h-full overflow-y-auto">
                  {mounted.has(index) && (
                    <div className="max-w-lg mx-auto px-4 py-4">
                      <Page />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}
