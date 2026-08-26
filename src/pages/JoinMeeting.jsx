import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Video, ArrowLeft, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingApi } from '../api/client';

export default function JoinMeeting() {
  const { meetingId: paramId } = useParams();
  const [meetingId, setMeetingId] = useState(paramId || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!meetingId.trim()) {
      toast.error('Enter a meeting ID');
      return;
    }
    setLoading(true);
    try {
      const id = meetingId.trim().toUpperCase();
      const pwd = password.trim();
      await meetingApi.join(id, { password: pwd || undefined });
      if (pwd) {
        sessionStorage.setItem(`meetlink_pwd_${id}`, pwd);
      } else {
        sessionStorage.removeItem(`meetlink_pwd_${id}`);
      }
      navigate(`/meeting/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not join meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link to="/dashboard" className="mb-8 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-600/30">
            <Video className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Join a meeting</h1>
          <p className="mt-2 text-sm text-slate-400">Enter the meeting ID from your host</p>
        </div>
        <form onSubmit={handleJoin} className="card space-y-4 p-8">
          <div>
            <label className="label flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Meeting ID</label>
            <input
              className="input uppercase tracking-[0.2em] font-semibold text-center text-lg"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="A1B2C3D4E5"
              required
            />
          </div>
          <div>
            <label className="label">Password (if required)</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
            {loading ? 'Joining…' : 'Join meeting'}
          </button>
        </form>
      </div>
    </div>
  );
}
