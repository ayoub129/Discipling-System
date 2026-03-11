'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Gift, AlertCircle, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const allActivities = [
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
  {
    id: 5,
    type: 'quest-completed',
    title: 'Quest Completed',
    description: 'Deep Work Session',
    value: '+25 XP',
    timestamp: '3 days ago',
    icon: CheckCircle2,
    color: 'text-accent',
  },
  {
    id: 6,
    type: 'quest-completed',
    title: 'Quest Completed',
    description: 'Meditation',
    value: '+5 XP',
    timestamp: '5 days ago',
    icon: CheckCircle2,
    color: 'text-accent',
  },
  {
    id: 7,
    type: 'reward-redeemed',
    title: 'Reward Redeemed',
    description: 'Coffee Break',
    value: '-2 pts',
    timestamp: '1 week ago',
    icon: Gift,
    color: 'text-primary',
  },
  {
    id: 8,
    type: 'level-up',
    title: 'Level Up',
    description: 'Reached Level 6',
    value: '+1 Level',
    timestamp: '1 week ago',
    icon: TrendingUp,
    color: 'text-accent',
  },
];

export default function ActivityPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [router]);

  const filters = [
    { id: 'all', label: 'All Activities' },
    { id: 'quest-completed', label: 'Quests Completed' },
    { id: 'reward-redeemed', label: 'Rewards Redeemed' },
    { id: 'level-up', label: 'Level Ups' },
    { id: 'penalty-triggered', label: 'Penalties' },
  ];

  const filteredActivities =
    selectedFilter === 'all'
      ? allActivities
      : allActivities.filter((activity) => activity.type === selectedFilter);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-primary to-secondary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <div className="md:ml-64 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Activity Log</h1>
              <p className="text-muted-foreground">Track all your discipline system activities and achievements</p>
            </div>

            {/* Filters */}
            <Card className="border-border bg-card/50 backdrop-blur card-glow p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={18} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Filter Activities</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <Button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    variant={selectedFilter === filter.id ? 'default' : 'outline'}
                    size="sm"
                    className={selectedFilter === filter.id ? 'bg-primary text-primary-foreground' : ''}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Activities List */}
            <Card className="border-border bg-card/50 backdrop-blur card-glow overflow-hidden">
              <div className="divide-y divide-border/30">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div
                        key={activity.id}
                        className="p-4 hover:bg-secondary/5 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg bg-secondary/10 flex-shrink-0 ${activity.color}`}>
                            <Icon size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <h3 className="font-semibold text-foreground text-lg">{activity.title}</h3>
                                <p className="text-sm text-muted-foreground">{activity.description}</p>
                              </div>
                              <span className="text-lg font-bold text-primary whitespace-nowrap flex-shrink-0">
                                {activity.value}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground/60">{activity.timestamp}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground">No activities found</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <Card className="border-border bg-card/50 backdrop-blur card-glow p-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">Total Activities</p>
                <p className="text-2xl font-bold text-foreground">{allActivities.length}</p>
              </Card>
              <Card className="border-border bg-card/50 backdrop-blur card-glow p-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">Quests Completed</p>
                <p className="text-2xl font-bold text-accent">
                  {allActivities.filter((a) => a.type === 'quest-completed').length}
                </p>
              </Card>
              <Card className="border-border bg-card/50 backdrop-blur card-glow p-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">Rewards Redeemed</p>
                <p className="text-2xl font-bold text-primary">
                  {allActivities.filter((a) => a.type === 'reward-redeemed').length}
                </p>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
