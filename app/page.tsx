'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { HeroStatus } from '@/components/hero-status';
import { TodayQuests } from '@/components/today-quests';
import { ScheduleView } from '@/components/schedule-view';
import { ProgressStats } from '@/components/progress-stats';
import { PenaltySystem } from '@/components/penalty-system';
import { ActivityLog } from '@/components/activity-log';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

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
            <HeroStatus />
            <ProgressStats />
            <TodayQuests />
            <ActivityLog />
            <ScheduleView />
            <PenaltySystem />
          </div>
        </main>
      </div>
    </div>
  );
}
