import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <button onClick={toggleTheme} className="absolute top-4 right-4 btn-ghost p-2 rounded-xl" aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-700 shadow-lg shadow-cyan-500/30">
              <Video className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">MeetLink</span>
          </Link>
          <p className="mt-3 muted">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-5 p-8">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm muted">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-cyan-500 hover:text-cyan-400">Create one</Link>
        </p>
      </div>
    </div>
  );
}
