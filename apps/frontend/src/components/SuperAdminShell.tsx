import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SuperAdminPage from '../pages/SuperAdminPage';

export default function SuperAdminShell() {
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">FinTrack Admin</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-3 mt-2">
            Management
          </div>
          <NavLink
            to="/superadmin"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            <span className="text-xl leading-none">👥</span>
            <span>Users</span>
          </NavLink>
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-6">
          <div className="flex items-center justify-between px-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                 {user?.username?.substring(0, 2).toUpperCase()}
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{user?.username}</span>
                 <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</span>
               </div>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full py-2.5 flex justify-center items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-lg font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Routes>
            <Route path="/" element={<SuperAdminPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
