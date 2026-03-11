'use client';

import { CheckCircle2, Gift, AlertCircle, TrendingUp } from 'lucide-react';

const activities = [
  {
    id: 1,
    type: 'quest-completed',
    title: 'Quest Completed',
    description: 'Workout',
    value: '+5 XP',
    timestamp: '2 hours ago',
    icon: CheckCircle2,
    color: 'text-accent',
  },
  {
    id: 2,
    type: 'reward-redeemed',
    title: 'Reward Redeemed',
    description: 'Watch 1 Episode',
    value: '-3 pts',
    timestamp: '4 hours ago',
    icon: Gift,
    color: 'text-primary',
  },
  {
    id: 3,
    type: 'level-up',
    title: 'Level Up',
    description: 'Reached Level 7',
    value: '+1 Level',
    timestamp: '1 day ago',
    icon: TrendingUp,
    color: 'text-accent',
  },
  {
    id: 4,
    type: 'penalty-triggered',
    title: 'Penalty Triggered',
    description: 'Missed B-Rank Quest',
    value: '+1 Penalty',
    timestamp: '2 days ago',
    icon: AlertCircle,
    color: 'text-destructive',
  },
];

export function ActivityLog() {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-4">Activity Log</h2>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden card-glow">
        <div className="divide-y divide-border/30">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div
                key={activity.id}
                className={`p-4 hover:bg-secondary/5 transition-colors ${
                  index !== activities.length - 1 ? 'border-b border-border/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-secondary/10 flex-shrink-0 ${activity.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className="font-semibold text-foreground">{activity.title}</h3>
                      <span className="text-sm font-bold text-primary whitespace-nowrap flex-shrink-0">
                        {activity.value}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{activity.description}</p>
                    <p className="text-xs text-muted-foreground/60">{activity.timestamp}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-secondary/5 text-center">
          <a href="/activity" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer">
            View All Activity →
          </a>
        </div>
      </div>
    </section>
  );
}
