import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Phone, Sun, Moon } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    phone: '',
  });
  const { register, loading } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <button onClick={toggleTheme} className="absolute top-4 right-4 btn-ghost p-2 rounded-xl" aria-label="Theme">
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 shadow-lg shadow-brand-600/30">
              <Video className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">MeetLink</span>
          </Link>
          <p className="mt-3 muted">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-8">
          <div>
            <label className="label">Display name</label>
            <input name="displayName" className="input" value={form.displayName} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Username</label>
            <input name="username" className="input" value={form.username} onChange={handleChange} required minLength={3} />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" value={form.email} onChange={handleChange} required />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-500" /> Contact number
            </label>
            <input
              name="phone"
              type="tel"
              className="input"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" className="input" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-cyan-500 hover:text-cyan-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
