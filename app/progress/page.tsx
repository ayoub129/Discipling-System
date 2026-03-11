'use client';

import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Zap, Target, AlertTriangle, Flame, Trophy } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ProgressStats {
  currentLevel: number;
  currentRank: string;
  totalXpEarned: number;
  totalQuestsCompleted: number;
  totalPenaltiesTriggered: number;
  totalRewardsRedeemed: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

interface TimeSeriesData {
  date: string;
  value: number;
}

interface RankChange {
  date: string;
  oldRank: string;
  newRank: string;
  levelReached?: number;
}

interface LevelHistoryItem {
  oldLevel: number;
  newLevel: number;
  xpAtLevelUp: number;
  date: string;
}

export default function ProgressPage() {
  const [dateFilter, setDateFilter] = useState<'today' | 'week'>('week');
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [rankHistory, setRankHistory] = useState<RankChange[]>([]);
  const [levelHistory, setLevelHistory] = useState<LevelHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{
    xp: TimeSeriesData[];
    quests: TimeSeriesData[];
    rewardPoints: TimeSeriesData[];
    penalties: TimeSeriesData[];
  } | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/progress');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setStats({
            currentLevel: data.currentLevel ?? 1,
            currentRank: data.currentRank ?? 'F-Rank',
            totalXpEarned: data.totalXpEarned ?? 0,
            totalQuestsCompleted: data.totalQuestsCompleted ?? 0,
            totalPenaltiesTriggered: data.totalPenaltiesTriggered ?? 0,
            totalRewardsRedeemed: data.totalRewardsRedeemed ?? 0,
            currentStreakDays: data.currentStreakDays ?? 0,
            longestStreakDays: data.longestStreakDays ?? 0,
          });
          setRankHistory(Array.isArray(data.rankHistory) ? data.rankHistory : []);
          setLevelHistory(Array.isArray(data.levelHistory) ? data.levelHistory : []);
        }
      } catch (e) {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setChartsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/progress/charts?range=${dateFilter}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setChartData({
            xp: data.xp ?? [],
            quests: data.quests ?? [],
            rewardPoints: data.rewardPoints ?? [],
            penalties: data.penalties ?? [],
          });
        }
      } catch {
        if (!cancelled) setChartData(null);
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dateFilter]);

  const formatRankDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const formatLevelDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const xpOverTime = chartData?.xp ?? [];
  const questsCompleted = chartData?.quests ?? [];
  const rewardPoints = chartData?.rewardPoints ?? [];
  const penaltiesData = chartData?.penalties ?? [];
  const maxXp = Math.max(1, ...xpOverTime.map((d) => d.value));
  const maxQuests = Math.max(1, ...questsCompleted.map((d) => d.value));
  const maxRewards = Math.max(1, ...rewardPoints.map((d) => d.value));
  const maxPenalties = Math.max(1, ...penaltiesData.map((d) => d.value));

  const ChartBar = ({ data, max, color }: { data: TimeSeriesData[]; max: number; color: string }) => (
    <div className="flex items-end gap-3 h-48">
      {data.map((item, idx) => {
        const safeMax = max > 0 ? max : 1;
        const ratio = item.value / safeMax;
        // Map 0 -> 4px, max -> 180px for a very visible difference
        const heightPx = item.value === 0 ? 4 : 4 + ratio * 176;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2">
            <div
              className={`w-full ${color} rounded-t-lg transition-all hover:opacity-80`}
              style={{ height: `${heightPx}px` }}
            />
            <span className="text-xs text-muted-foreground">{item.date}</span>
            <span className="text-xs font-semibold">{item.value}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="md:ml-64 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Progress Analytics</h1>
              <p className="text-muted-foreground">Long-term performance tracking and analysis</p>
            </div>

            {/* Stats: 3 top + 3 bottom */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="border-border bg-card/50 backdrop-blur p-6 animate-pulse">
                    <div className="h-5 bg-muted rounded w-2/3 mb-4" />
                    <div className="h-10 bg-muted rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : stats ? (
              <>
                {/* Top 3 cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card className="border-border bg-card/50 backdrop-blur p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">Current Level</div>
                      <Award className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-4xl font-bold mb-2">{stats.currentLevel}</div>
                    <div className="text-xs text-muted-foreground">Next: Level {stats.currentLevel + 1}</div>
                  </Card>
                  <Card className="border-border bg-card/50 backdrop-blur p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">Current Rank</div>
                      <Trophy className="w-5 h-5 text-accent" />
                    </div>
                    <div className="text-4xl font-bold mb-2">{stats.currentRank}</div>
                    <div className="text-xs text-muted-foreground">Your current tier</div>
                  </Card>
                  <Card className="border-border bg-card/50 backdrop-blur p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">Total XP Earned</div>
                      <Zap className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="text-4xl font-bold mb-2">{stats.totalXpEarned.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">All time</div>
                  </Card>
                </div>
                {/* Bottom 3 cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <Card className="border-border bg-card/50 backdrop-blur p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Target className="w-5 h-5 text-secondary" />
                      <div className="text-sm text-muted-foreground">Total Quests Completed</div>
                    </div>
                    <div className="text-3xl font-bold">{stats.totalQuestsCompleted}</div>
                    <div className="text-xs text-muted-foreground">All time</div>
                  </Card>
                  <Card className="border-border bg-card/50 backdrop-blur p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <div className="text-sm text-muted-foreground">Penalties Triggered</div>
                    </div>
                    <div className="text-3xl font-bold">{stats.totalPenaltiesTriggered}</div>
                    <div className="text-xs text-muted-foreground">All time</div>
                  </Card>
                  <Card className="border-border bg-card/50 backdrop-blur p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Flame className="w-5 h-5 text-orange-400" />
                      <div className="text-sm text-muted-foreground">Streak</div>
                    </div>
                    <div className="text-3xl font-bold">{stats.currentStreakDays} days</div>
                    <div className="text-xs text-muted-foreground">Best: {stats.longestStreakDays} days</div>
                  </Card>
                </div>
              </>
            ) : (
              <div className="mb-8 text-muted-foreground">Failed to load progress stats.</div>
            )}

            {/* Date Filter: today | week */}
            <div className="mb-6 flex gap-2">
              {(['today', 'week'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateFilter === filter
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-card/50 border border-border/30 text-muted-foreground hover:border-border'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Charts Section — real data, filter: today (15h 09–00) or week */}
            <Tabs defaultValue="xp" className="w-full">
              <TabsList className="bg-card/50 border border-border mb-6">
                <TabsTrigger value="xp">XP Over Time</TabsTrigger>
                <TabsTrigger value="quests">Quests Completed</TabsTrigger>
                <TabsTrigger value="rewards">Reward Points</TabsTrigger>
                <TabsTrigger value="penalties">Penalties Over Time</TabsTrigger>
              </TabsList>

              <TabsContent value="xp" className="mt-6">
                <Card className="border-border bg-card/50 backdrop-blur p-6">
                  <h2 className="text-xl font-semibold mb-6">XP Earned Over Time ({dateFilter === 'today' ? 'by hour 09→00' : 'this week'})</h2>
                  {chartsLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">Loading…</div>
                  ) : (
                    <ChartBar data={xpOverTime} max={maxXp} color="bg-gradient-to-t from-primary/50 to-primary" />
                  )}
                </Card>
              </TabsContent>
              <TabsContent value="quests" className="mt-6">
                <Card className="border-border bg-card/50 backdrop-blur p-6">
                  <h2 className="text-xl font-semibold mb-6">Quests Completed Over Time</h2>
                  {chartsLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">Loading…</div>
                  ) : (
                    <ChartBar data={questsCompleted} max={maxQuests} color="bg-gradient-to-t from-secondary/50 to-secondary" />
                  )}
                </Card>
              </TabsContent>
              <TabsContent value="rewards" className="mt-6">
                <Card className="border-border bg-card/50 backdrop-blur p-6">
                  <h2 className="text-xl font-semibold mb-6">Reward Points Earned</h2>
                  {chartsLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">Loading…</div>
                  ) : (
                    <ChartBar data={rewardPoints} max={maxRewards} color="bg-gradient-to-t from-accent/50 to-accent" />
                  )}
                </Card>
              </TabsContent>
              <TabsContent value="penalties" className="mt-6">
                <Card className="border-border bg-card/50 backdrop-blur p-6">
                  <h2 className="text-xl font-semibold mb-6">Penalties Over Time</h2>
                  {chartsLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">Loading…</div>
                  ) : (
                    <ChartBar data={penaltiesData} max={maxPenalties} color="bg-gradient-to-t from-red-500/50 to-red-500" />
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            {/* Rank History & Level History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              {/* Rank History */}
              <Card className="border-border bg-card/50 backdrop-blur p-6">
                <h2 className="text-xl font-semibold mb-6">Rank History</h2>
                {stats && (
                  <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-xs text-muted-foreground">Current rank</div>
                    <div className="text-lg font-semibold text-primary">{stats.currentRank}</div>
                  </div>
                )}
                <div className="space-y-4">
                  {rankHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rank changes yet. Reach the required level for the next rank to advance.</p>
                  ) : (
                    rankHistory.map((record, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/20">
                        <div>
                          <div className="text-sm text-muted-foreground">{formatRankDate(record.date)}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className="bg-secondary/20 text-secondary border-secondary/30">{record.oldRank}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge className="bg-primary/20 text-primary border-primary/30">{record.newRank}</Badge>
                            {record.levelReached != null && (
                              <span className="text-xs text-muted-foreground">(Level {record.levelReached})</span>
                            )}
                          </div>
                        </div>
                        <Trophy className="w-5 h-5 text-accent flex-shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Level Progression Timeline — real data from level_history */}
              <Card className="border-border bg-card/50 backdrop-blur p-6">
                <h2 className="text-xl font-semibold mb-6">Level Progression Timeline</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {levelHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No level-ups yet. Complete quests to earn XP and level up.</p>
                  ) : (
                    levelHistory.map((milestone, idx) => (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                          <span className="text-xs font-semibold text-primary">{milestone.newLevel}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">{formatLevelDate(milestone.date)}</div>
                          <div className="text-sm font-semibold">
                            Level {milestone.oldLevel} → Level {milestone.newLevel}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {milestone.xpAtLevelUp.toLocaleString()} total XP at level-up
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Rewards Statistics — real data from reward_redemptions */}
            {stats && (
              <Card className="border-border bg-card/50 backdrop-blur p-6 mt-8">
                <h2 className="text-xl font-semibold mb-6">Rewards Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-card/50 border border-border/20 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">Total Rewards Redeemed</div>
                    <div className="text-4xl font-bold text-accent">{stats.totalRewardsRedeemed}</div>
                    <div className="text-xs text-muted-foreground mt-1">From reward redemptions</div>
                  </div>
                  <div className="p-6 bg-card/50 border border-border/20 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">Average Per Week</div>
                    <div className="text-4xl font-bold text-secondary">
                      {stats.totalRewardsRedeemed > 0 ? Math.round(stats.totalRewardsRedeemed / 52) : 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Over 52 weeks</div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
