'use client';

import Link from 'next/link';
import { Clock, Play, CheckCircle2, Pause, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface TodayQuestItem {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
  xp_reward: number;
  reward_points: number;
  rank_code?: string;
  rank_name?: string;
}

const staticQuests = [
  { id: '1', title: 'Deep Work Session', category: 'Work', startTime: '08:00', endTime: '10:00', rank: 'A', status: 'pending', reward: 50, xp: 150 },
  { id: '2', title: 'Morning Workout', category: 'Health', startTime: '10:15', endTime: '11:00', rank: 'B', status: 'in-progress', reward: 20, xp: 60 },
  { id: '3', title: 'Client Project Review', category: 'Work', startTime: '11:30', endTime: '12:30', rank: 'A', status: 'completed', reward: 40, xp: 120 },
  { id: '4', title: 'Upwork Proposals', category: 'Freelance', startTime: '15:45', endTime: '16:45', rank: 'C', status: 'delayed', reward: 15, xp: 45 },
];

function getRankColor(rank: string) {
  const colors: Record<string, string> = {
    S: 'bg-accent/20 text-accent border-accent/30',
    A: 'bg-primary/20 text-primary border-primary/30',
    B: 'bg-secondary/20 text-secondary border-secondary/30',
    C: 'bg-muted/20 text-muted-foreground border-muted/30',
    F: 'bg-destructive/20 text-destructive border-destructive/30',
  };
  return colors[rank] || colors.C;
}

interface TodayQuestsProps {
  quests?: TodayQuestItem[];
  /** Map category id -> name so we show name instead of id */
  categoryMap?: Record<string, string>;
  onStatusChange?: (questId: string, newStatus: string) => void;
  loading?: boolean;
}

function getStatusConfig(status: string) {
  const configs: Record<string, { icon: any; color: string; label: string }> = {
    pending: {
      icon: AlertCircle,
      color: 'text-muted-foreground',
      label: 'Pending',
    },
    'in-progress': {
      icon: Play,
      color: 'text-primary',
      label: 'In Progress',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-accent',
      label: 'Completed',
    },
    delayed: {
      icon: Pause,
      color: 'text-destructive',
      label: 'Delayed',
    },
  };
  return configs[status] || configs.pending;
}

function formatTime(iso: string | null) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TodayQuests({ quests: propQuests, categoryMap, onStatusChange, loading }: TodayQuestsProps) {
  const useReal = Array.isArray(propQuests);
  const list = useReal
    ? propQuests.map((q) => ({
        id: q.id,
        title: q.title,
        // category is stored as id; resolve to name. If not in map, show as-is (might be name from older data)
        category: q.category ? (categoryMap?.[q.category] ?? q.category) : '',
        startTime: formatTime(q.planned_start),
        endTime: formatTime(q.planned_end),
        rank: q.rank_code || 'C',
        status: q.status,
        reward: q.reward_points ?? 0,
        xp: q.xp_reward ?? 0,
      }))
    : staticQuests;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Today's Quests</h2>
        <span className="text-sm text-muted-foreground">
          {loading ? '…' : `${list.length} quests`}
        </span>
      </div>

      {loading && useReal ? (
        <div className="bg-card border border-border/50 rounded-xl p-8 text-center text-muted-foreground">
          Loading today's quests…
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((quest) => {
            const statusConfig = getStatusConfig(quest.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={quest.id}
                className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/50 transition-colors card-glow group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{quest.title}</h3>
                      <Badge
                        variant="outline"
                        className={`${getRankColor(quest.rank)} border font-bold text-xs`}
                      >
                        {quest.rank}-Rank
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {quest.category || '—'}
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>
                          {quest.startTime} - {quest.endTime}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Reward:</span>
                        <span className="font-semibold text-primary">{quest.reward} pts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">XP:</span>
                        <span className="font-semibold text-accent">{quest.xp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className={`flex items-center gap-1 text-sm font-semibold ${statusConfig.color}`}>
                      <StatusIcon size={16} />
                      <span className="hidden sm:inline">{statusConfig.label}</span>
                    </div>

                    {useReal && onStatusChange && (
                      <>
                        {quest.status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg"
                            onClick={() => onStatusChange(quest.id, 'in-progress')}
                          >
                            Start
                          </Button>
                        )}
                        {quest.status === 'in-progress' && (
                          <Button
                            size="sm"
                            className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 rounded-lg"
                            onClick={() => onStatusChange(quest.id, 'completed')}
                          >
                            Complete
                          </Button>
                        )}
                        {quest.status === 'completed' && (
                          <Button size="sm" disabled className="bg-accent/10 text-accent border border-accent/20 rounded-lg">
                            ✓ Done
                          </Button>
                        )}
                        {quest.status === 'delayed' && (
                          <Button
                            size="sm"
                            className="bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 rounded-lg"
                          >
                            Delay
                          </Button>
                        )}
                      </>
                    )}

                    {!useReal && (
                      <>
                        {quest.status === 'pending' && (
                          <Button size="sm" className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg">
                            Start
                          </Button>
                        )}
                        {quest.status === 'in-progress' && (
                          <Button size="sm" className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 rounded-lg">
                            Complete
                          </Button>
                        )}
                        {quest.status === 'completed' && (
                          <Button size="sm" disabled className="bg-accent/10 text-accent border border-accent/20 rounded-lg">
                            ✓ Done
                          </Button>
                        )}
                        {quest.status === 'delayed' && (
                          <Button size="sm" className="bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 rounded-lg">
                            Delay
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {useReal && !loading && list.length === 0 && (
        <div className="bg-card border border-border/50 rounded-xl p-6 text-center text-muted-foreground">
          No quests for today. <Link href="/quests" className="text-primary hover:underline">Add a quest</Link>
        </div>
      )}
    </section>
  );
}
