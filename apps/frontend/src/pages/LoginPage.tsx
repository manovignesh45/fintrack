import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme, type Theme } from '../context/ThemeContext';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { login } = useAuth();
  const { setTheme } = useTheme();
  const navigate = useNavigate();

  // Apply the logged-in user's saved theme immediately (no page reload needed).
  const applyUserTheme = (theme?: string) => {
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      setTheme(theme as Theme);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isForgotPassword) {
        await authApi.resetPassword({ username, temp_password: tempPassword, new_password: newPassword });
        setIsForgotPassword(false);
        setPassword('');
        setTempPassword('');
        setNewPassword('');
        alert('Password reset successfully. You can now login.');
      } else if (isRegistering) {
        await authApi.register({ username, password });
        // After registration, log them in automatically
        const loginRes = await authApi.login({ username, password });
        login(loginRes.user, loginRes.token);
        applyUserTheme(loginRes.user.preferences?.theme);
        navigate('/');
      } else {
        const res = await authApi.login({ username, password });
        login(res.user, res.token);
        applyUserTheme(res.user.preferences?.theme);
        if (res.user.role === 'superadmin') {
          navigate('/superadmin');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-700 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">
          FinTrack
        </h1>
        <h2 className="text-xl font-semibold text-center mb-8">
          {isForgotPassword ? 'Reset Password' : isRegistering ? 'Create an Account' : 'Login to Your Account'}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {isForgotPassword ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 dark:bg-gray-800 dark:text-white"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 dark:bg-gray-800 dark:text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 dark:bg-gray-800 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-400 focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition"
          >
            {isForgotPassword ? 'Reset Password' : isRegistering ? 'Register' : 'Login'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center space-y-3">
            {!isForgotPassword && !isRegistering && (
              <button 
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-indigo-600 hover:underline text-sm"
              >
                Forgot Password?
              </button>
            )}
            
            {(isForgotPassword || isRegistering) ? (
              <button 
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setIsForgotPassword(false);
                }}
                className="text-indigo-600 hover:underline text-sm"
              >
                Back to Login
              </button>
            ) : (
              <button 
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-indigo-600 hover:underline text-sm"
              >
                  Need an account? Register
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
