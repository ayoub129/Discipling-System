'use client';

import { useEffect, useState } from 'react';
import { notifyUpdated, celebrate } from '@/lib/feedback';
import { toast } from 'sonner';
import { Onboarding } from '@/components/onboarding';
import { dateKey } from '@/lib/time';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { HeroStatus } from '@/components/hero-status';
import { TodayQuests } from '@/components/today-quests';
import { ScheduleView } from '@/components/schedule-view';
import { PenaltySystem } from '@/components/penalty-system';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface DashboardProfile {
  name: string;
  level: number;
  rank: string;
  currentXP: number;
  xpToNextLevel: number;
  xpThisWeek: number;
  availablePoints: number;
  disciplineScore: number;
  activePenalties: number;
  streak: number;
}

interface QuestItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
  xp_reward: number;
  reward_points: number;
  rank_code?: string;
  rank_name?: string;
}

interface PenaltyItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  penalty_definitions?: { severity_order?: number };
}

export default function SystemPanel() {
  const router = useRouter();
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [todayQuests, setTodayQuests] = useState<QuestItem[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [activePenalties, setActivePenalties] = useState<PenaltyItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const toLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = async () => {
      try {
        setDataLoading(true);
        setLoadError('');
        const [profileRes, questsRes, penaltiesRes, chartsRes, categoriesRes] = await Promise.all([
          fetch('/api/user-profile'),
          fetch('/api/quests'),
          fetch('/api/penalties'),
          fetch('/api/progress/charts?range=week'),
          fetch('/api/categories'),
        ]);

        if (cancelled) return;
        if (![profileRes, questsRes, penaltiesRes, chartsRes, categoriesRes].every(r=>r.ok)) throw new Error('Could not load your dashboard. Please retry.');
        const p = await profileRes.json();
        const today = dateKey(new Date(), p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

        let profileData: DashboardProfile | null = null;
        if (profileRes.ok) {
          profileData = {
            name: p.fullName || p.username || 'User',
            level: p.level ?? 1,
            rank: p.rank ?? 'F-Rank',
            currentXP: p.currentXP ?? 0,
            xpToNextLevel: p.requiredXP ?? 100,
            xpThisWeek: 0,
            availablePoints: p.points ?? 0,
            disciplineScore: p.disciplineScore ?? 0,
            activePenalties: 0,
            streak: p.streakDays ?? 0,
          };
        }

        if (categoriesRes.ok) {
          const cat = await categoriesRes.json();
          const map: Record<string, string> = {};
          (cat.categories || []).forEach((c: { id: string; name: string }) => {
            map[c.id] = c.name;
          });
          setCategoryMap(map);
        }

        if (questsRes.ok) {
          const q = await questsRes.json();
          const quests = (q.quests || []).filter((x: QuestItem) => x.date === today);
          quests.sort((a: QuestItem, b: QuestItem) => {
            const ta = a.planned_start ? new Date(a.planned_start).getTime() : 0;
            const tb = b.planned_start ? new Date(b.planned_start).getTime() : 0;
            return ta - tb;
          });
          setTodayQuests(quests);
        }

        if (penaltiesRes.ok) {
          const pen = await penaltiesRes.json();
          const active = (pen.userPenalties || []).filter((p: PenaltyItem) =>
            ['created', 'in-progress', 'active'].includes(p.status),
          );
          setActivePenalties(active);
          if (profileData) profileData.activePenalties = active.length;
        }

        if (chartsRes.ok) {
          const charts = await chartsRes.json();
          const weekXp = (charts.xp || []).reduce((s: number, d: { value: number }) => s + d.value, 0);
          if (profileData) profileData.xpThisWeek = weekXp;
        }

        if (profileData) setProfile(profileData);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load dashboard');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authLoading, reload]);

  const handleQuestStatusChange = async (questId: string, newStatus: string) => {
    const prev = [...todayQuests];
    setTodayQuests((q) =>
      q.map((x) => (x.id === questId ? { ...x, status: newStatus } : x)),
    );
    try {
      const res = await fetch('/api/quests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: questId, status: newStatus }),
      });
      if (!res.ok) { const data=await res.json(); throw new Error(data.error || 'Could not update quest'); }
      notifyUpdated(newStatus === 'completed' ? 'Quest complete. Well done!' : 'Quest started');
      if (newStatus === 'completed') celebrate();
      setReload(v=>v+1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update quest');
      setTodayQuests(prev);
    }
  };

  const handlePenaltyComplete = async (penaltyId: string) => {
    try {
      const res = await fetch('/api/penalties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: penaltyId, action: 'complete' }),
      });
      if (!res.ok) { const data=await res.json(); throw new Error(data.error || 'Could not complete penalty'); }
      if (res.ok) {
        notifyUpdated('Penalty completed');
        setReload(v=>v+1);
        setActivePenalties((p) => p.filter((x) => x.id !== penaltyId));
        setProfile((prev) => prev ? { ...prev, activePenalties: Math.max(0, (prev.activePenalties ?? 0) - 1) } : null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not complete penalty');
    }
  };

  if (authLoading) {
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
          <Onboarding />
          {loadError && <div role="alert" className="mx-6 mt-6 p-4 border border-destructive/40 rounded-xl">{loadError}<Button variant="outline" className="ml-4" onClick={() => setReload(v=>v+1)}>Retry</Button></div>}
          <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-end">
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <Link href="/quests">
                  <Plus className="w-4 h-4" />
                  Add Quest
                  </Link>
                </Button>
            </div>

            <section>
              <HeroStatus
                name={profile?.name}
                level={profile?.level}
                rank={profile?.rank}
                currentXP={profile?.currentXP}
                xpToNextLevel={profile?.xpToNextLevel}
                xpThisWeek={profile?.xpThisWeek}
                availablePoints={profile?.availablePoints}
                disciplineScore={profile?.disciplineScore}
                activePenalties={profile?.activePenalties}
                streak={profile?.streak}
                loading={dataLoading}
              />
            </section>

            <section>
              <TodayQuests
                quests={todayQuests}
                categoryMap={categoryMap}
                onStatusChange={handleQuestStatusChange}
                loading={dataLoading}
              />
            </section>

            <section>
              <ScheduleView todayQuests={todayQuests} loading={dataLoading} />
            </section>

            <section>
              <PenaltySystem
                activePenalties={activePenalties}
                onMarkDone={handlePenaltyComplete}
                loading={dataLoading}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
