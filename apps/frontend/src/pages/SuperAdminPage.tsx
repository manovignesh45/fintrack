import { useState, useEffect } from 'react';
import { adminApi } from '../api/client';

export default function SuperAdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedUser && !userToDelete) return;
      
      if (e.key === 'Escape') {
        setSelectedUser(null);
        setUserToDelete(null);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        if (selectedUser) handleResetPassword();
        if (userToDelete) handleDeleteUser();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const buttons = Array.from(document.querySelectorAll('.modal-btn')) as HTMLElement[];
        if (buttons.length >= 2) {
          const active = document.activeElement as HTMLElement;
          const currentIndex = buttons.indexOf(active);
          if (currentIndex !== -1) {
            const nextIndex = e.key === 'ArrowRight' 
              ? (currentIndex + 1) % buttons.length 
              : (currentIndex - 1 + buttons.length) % buttons.length;
            buttons[nextIndex].focus();
          } else {
            buttons[0].focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, userToDelete, tempPassword]); // tempPassword is used in handleResetPassword

  const fetchUsers = async () => {
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!tempPassword) return;
    try {
      await adminApi.resetPassword({ user_id: selectedUser.id, temp_password: tempPassword });
      alert(`Password for ${selectedUser.username} successfully reset to: ${tempPassword}`);
      setSelectedUser(null);
      setTempPassword('');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await adminApi.deleteUser(userToDelete.id);
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Superadmin Dashboard</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg dark:bg-red-900/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">{user.username}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      if (autoGenerate) setTempPassword(generateRandomPassword());
                      else setTempPassword('');
                    }}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Reset Password
                  </button>
                  {user.role !== 'superadmin' && (
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete User"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Reset Password for {selectedUser.username}</h3>
            
            <div className="mb-4">
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => {
                    setAutoGenerate(e.target.checked);
                    if (e.target.checked) setTempPassword(generateRandomPassword());
                    else setTempPassword('');
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Auto-generate password</span>
              </label>
              
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                readOnly={autoGenerate}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter temporary password"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Give this password to the user. They will use it in the "Forgot Password" flow to set a new password.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                autoFocus
                className="modal-btn px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!tempPassword}
                className="modal-btn px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">{userToDelete.username}</span>? This will also delete all their ledgers, accounts, and transactions. This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setUserToDelete(null)}
                autoFocus
                className="modal-btn px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="modal-btn px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
