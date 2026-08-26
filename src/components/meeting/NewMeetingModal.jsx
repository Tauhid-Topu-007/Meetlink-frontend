import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Video, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingApi } from '../../api/client';
import useAuthStore from '../../store/authStore';

/**
 * Modal to start an instant meeting with optional password & waiting room.
 */
export default function NewMeetingModal({ open, onClose, asGroup = false }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const defaultTitle = asGroup
        ? `${user?.displayName || 'Team'} Group Meeting`
        : `${user?.displayName || 'My'}'s Meeting`;
      const { data } = await meetingApi.create({
        title: title.trim() || defaultTitle,
        type: asGroup ? 'group' : 'instant',
        isGroup: asGroup,
        groupName: asGroup ? 'Quick group' : undefined,
        password: password.trim() || undefined,
        waitingRoomEnabled: waitingRoom,
      });
      const id = data.meeting?.meetingId;
      if (!id) throw new Error('No meeting ID returned');
      toast.success(
        password.trim()
          ? 'Meeting created with password'
          : asGroup
            ? 'Group meeting started'
            : 'Meeting created'
      );
      onClose?.();
      navigate(`/meeting/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Could not create meeting');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-indigo-500" />
            {asGroup ? 'New group meeting' : 'New meeting'}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="label">Title (optional)</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${user?.displayName || 'My'}'s Meeting`}
          />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Meeting password (optional)
          </label>
          <input
            type="text"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty for no password"
            autoComplete="off"
          />
          <p className="text-xs muted mt-1">
            Guests will need this password to join (host does not need it).
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={waitingRoom}
            onChange={(e) => setWaitingRoom(e.target.checked)}
            className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
          />
          Enable waiting room (host approval)
        </label>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? 'Creating…' : 'Start meeting'}
          </button>
        </div>
      </form>
    </div>
  );
}
