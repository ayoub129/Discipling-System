'use client';

import Link from 'next/link';
import { Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ScheduleQuestItem {
  id: string;
  title: string;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
  xp_reward: number;
}

interface StaticScheduleItem {
  id: string;
  time: string;
  title: string;
  duration: string;
  xp: number;
  status: string;
  category: string;
  delayed?: boolean;
}

const staticItems: StaticScheduleItem[] = [
  { id: '1', time: '08:00', title: 'Deep Work Session', duration: '2h', xp: 25, status: 'completed', category: 'work' },
  { id: '2', time: '10:15', title: 'Workout', duration: '45m', xp: 15, status: 'completed', category: 'health' },
  { id: '3', time: '11:30', title: 'Client Project', duration: '1h', xp: 20, status: 'completed', category: 'work' },
  { id: '4', time: '15:45', title: 'Upwork Proposals', duration: '1h', xp: 12, status: 'delayed', category: 'work', delayed: true },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-accent';
    case 'in-progress':
      return 'text-primary';
    case 'delayed':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
};

function formatTime(iso: string | null) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return '—';
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  const m = Math.round((b - a) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();
}

interface ScheduleViewProps {
  todayQuests?: ScheduleQuestItem[];
  loading?: boolean;
}

export function ScheduleView({ todayQuests, loading }: ScheduleViewProps) {
  const useReal = Array.isArray(todayQuests);
  const realItems: ScheduleQuestItem[] = useReal ? todayQuests : [];
  const hasShift = useReal
    ? realItems.some((q) => {
        if (q.status === 'completed' || !q.planned_end) return false;
        return new Date(q.planned_end).getTime() < Date.now();
      })
    : true;

  const total = useReal ? realItems.length : 4;
  const completed = useReal ? realItems.filter((q) => q.status === 'completed').length : 3;
  const totalXP = useReal ? realItems.reduce((s, q) => s + (q.xp_reward || 0), 0) : 72;

  return (
    <section className="mb-6">
      <h2 className="text-xl font-bold text-foreground mb-4">Today's Schedule</h2>

      <div className="bg-card border border-border/50 rounded-xl p-6 card-glow space-y-4">
        {loading && useReal ? (
          <div className="py-8 text-center text-muted-foreground">Loading schedule…</div>
        ) : (
          <>
            {hasShift && (
              <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                <AlertCircle size={20} className="text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive mb-1">Schedule Shift Detected</p>
                  <p className="text-destructive/80 text-xs">Some quests are delayed. Next tasks may be shifted.</p>
                </div>
              </div>
            )}

            {useReal ? (
              realItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No schedule for today. <Link href="/quests" className="text-primary hover:underline">Add a quest</Link> or check the <Link href="/calendar" className="text-primary hover:underline">calendar</Link>.
                </div>
              ) : (
                <div className="space-y-3">
                  {realItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="relative flex gap-4 p-4 rounded-lg border transition-all bg-secondary/5 border-border/50 hover:border-primary/50"
                    >
                      {index !== realItems.length - 1 && (
                        <div className="absolute left-[2.5rem] top-full h-6 w-0.5 bg-border/30" />
                      )}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${getStatusColor(item.status)}`}>
                          {item.status === 'completed' && <CheckCircle size={16} className="fill-current" />}
                        </div>
                        <span className="text-xs font-mono font-semibold text-foreground">
                          {formatTime(item.planned_start)}
                        </span>
                      </div>
                      <div className="flex-1 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground">{item.title}</h3>
                            {item.status === 'delayed' && (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/50 text-xs">Delayed</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock size={14} />
                            <span>{formatDuration(item.planned_start, item.planned_end)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-secondary/20 rounded-lg border border-secondary/30 flex-shrink-0">
                          <Zap size={16} className="text-secondary" />
                          <span className="font-bold text-secondary">{item.xp_reward}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {staticItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`relative flex gap-4 p-4 rounded-lg border transition-all bg-secondary/5 border-border/50 hover:border-primary/50`}
                  >
                    {index !== staticItems.length - 1 && (
                      <div className="absolute left-[2.5rem] top-full h-6 w-0.5 bg-border/30" />
                    )}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${getStatusColor(item.status)}`}>
                        {item.status === 'completed' && <CheckCircle size={16} className="fill-current" />}
                      </div>
                      <span className="text-xs font-mono font-semibold text-foreground">{item.time}</span>
                    </div>
                    <div className="flex-1 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          {item.delayed && (
                            <Badge className="bg-destructive/20 text-destructive border-destructive/50 text-xs">Delayed</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock size={14} />
                          <span>{item.duration}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-secondary/20 rounded-lg border border-secondary/30 flex-shrink-0">
                        <Zap size={16} className="text-secondary" />
                        <span className="font-bold text-secondary">{item.xp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(useReal ? realItems.length > 0 : true) && (
              <div className="mt-6 pt-4 border-t border-border/30 grid grid-cols-3 gap-3">
                <div className="text-center p-2">
                  <p className="text-xs text-muted-foreground mb-1">Total Tasks</p>
                  <p className="text-lg font-bold text-foreground">{total}</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-xs text-muted-foreground mb-1">Completed</p>
                  <p className="text-lg font-bold text-accent">{completed}</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-xs text-muted-foreground mb-1">Total XP</p>
                  <p className="text-lg font-bold text-primary">{totalXP}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
