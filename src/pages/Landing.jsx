import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video, Users, Shield, MessageSquare, Calendar, Monitor,
  ArrowRight, CircleDot, FileUp, ClipboardList, Sparkles, Sun, Moon,
  LayoutGrid, Zap,
} from 'lucide-react';
import useThemeStore from '../store/themeStore';

const features = [
  { icon: Video, title: 'Cinema-grade calls', desc: 'Adaptive HD video, crystal audio, and screen share that feels effortless.' },
  { icon: LayoutGrid, title: 'Breakout rooms', desc: 'Split into focused groups, broadcast to all, then reunite in one click.' },
  { icon: MessageSquare, title: 'Rich collaboration', desc: 'Chat with files, reactions, notes, and attendance exports.' },
  { icon: Calendar, title: 'Smart schedule', desc: 'Calendar + live clock. Invite people or entire groups securely.' },
  { icon: CircleDot, title: 'One-tap record', desc: 'Capture sessions locally and keep the conversation going later.' },
  { icon: Shield, title: 'Secure by default', desc: 'Passwords, waiting rooms, host controls, and private group access.' },
];

export default function Landing() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-orb -left-20 top-0 h-72 w-72 bg-cyan-500/30" />
      <div className="mesh-orb right-0 top-40 h-64 w-64 bg-amber-500/20" />
      <div className="mesh-orb bottom-0 left-1/3 h-80 w-80 bg-sky-600/15" />

      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="logo-mark">
              <Video className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">MeetLink</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-xl" aria-label="Theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
            <Link to="/register" className="btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      <section className="relative px-6 pb-24 pt-16 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-600 dark:text-cyan-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Built for teams who live on calls
            </span>
            <h1 className="mt-8 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Meetings with{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300 bg-clip-text text-transparent">
                gravity
              </span>
              <br />
              and zero friction
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed muted">
              A real-time platform with breakouts, group invites, recording, attendance, and a UI that feels designed — not default.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link to="/register" className="btn-primary px-8 py-3.5 text-base shadow-glow">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="btn-secondary px-8 py-3.5 text-base">
                Sign in
              </Link>
            </div>
            <div className="mt-14 flex flex-wrap justify-center gap-3 text-xs sm:text-sm muted">
              {[
                { icon: Zap, t: 'Instant + scheduled' },
                { icon: FileUp, t: 'File chat' },
                { icon: ClipboardList, t: 'Excel attendance' },
                { icon: Monitor, t: 'Screen stage' },
              ].map(({ icon: Icon, t }) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 backdrop-blur">
                  <Icon className="h-3.5 w-3.5 text-cyan-500" /> {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="mb-12 text-center">
          <h2 className="section-title">Everything in the room</h2>
          <p className="mt-3 muted">Not another grey grid — a complete collaboration surface.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card-hover group p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-sky-600/10 text-cyan-500 transition group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed muted">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-4xl border border-[var(--border)] p-10 sm:p-14 text-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-amber-500/10" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready when you are</h2>
            <p className="mt-3 muted">Create an account and launch a room in under a minute.</p>
            <Link to="/register" className="btn-primary mt-8 inline-flex px-8 py-3 text-base">
              Create free account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-10 text-center text-sm muted">
        © {new Date().getFullYear()} MeetLink · Crafted for real conversations
      </footer>
    </div>
  );
}
