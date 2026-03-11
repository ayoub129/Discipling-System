'use client';

import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';

const stats = [
  {
    label: 'Completion Rate',
    value: '87%',
    progress: 87,
    color: 'bg-primary',
  },
  {
    label: 'Weekly XP',
    value: '485',
    subtext: '+65 from last week',
    progress: 65,
    color: 'bg-accent',
  },
  {
    label: 'Tasks Completed',
    value: '23',
    subtext: '4 this week',
    progress: 92,
    color: 'bg-secondary',
  },
  {
    label: 'Streak Days',
    value: '12',
    subtext: 'Personal record',
    progress: 100,
    color: 'bg-accent',
  },
];

export function ProgressStats() {
  return (
    <section className="mb-6">
      <h2 className="text-xl font-bold text-foreground mb-4">Progress Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-card border border-border/50 rounded-xl p-4 card-glow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                {stat.subtext && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
                )}
              </div>
              <TrendingUp size={18} className="text-accent flex-shrink-0" />
            </div>

            <Progress
              value={stat.progress}
              className="h-1.5 bg-secondary/20 border border-border/30"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
