import { Film, Download, Clock } from 'lucide-react';
import AppShell from '../components/layout/AppShell';

export default function Recordings() {
  // Client-side recordings are downloaded at stop time; this page is the archive UI shell
  const localNote = 'Recordings you capture in a meeting download as WebM files to your device. Cloud archive can be connected later via storage abstraction.';

  return (
    <AppShell title="Recordings">
      <p className="muted text-sm mb-6">{localNote}</p>
      <div className="card p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--hover)]">
          <Film className="h-7 w-7 text-[var(--muted)]" />
        </div>
        <h2 className="text-lg font-semibold">No cloud recordings yet</h2>
        <p className="muted text-sm mt-2 max-w-md mx-auto">
          Start a meeting as host and use the <strong>Record</strong> control. When you stop, the file saves to your downloads folder.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1"><Clock className="h-3.5 w-3.5" /> Unlimited duration</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1"><Download className="h-3.5 w-3.5" /> Local WebM export</span>
        </div>
      </div>
    </AppShell>
  );
}
