'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Gift, Zap, Lock, Unlock, Plus } from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  cost: number;
  category: string;
  description: string;
  minLevel: number;
  minRankId: string | null;
  minRankCode: string | null;
  minDisciplineScore: number;
  cooldownHours: number;
  maxRedemptionsPerWeek: number | null;
}

interface RedeemedReward {
  id: string;
  rewardId: number;
  name: string;
  cost: number;
  redeemedAt: Date;
}

interface RankDefinition {
  id: string;
  code: string;
  name: string;
}

interface UserState {
  level: number;
  rankName: string;
  rankCode: string | null;
  currentRankId: string | null;
  points: number;
  disciplineScore: number;
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    'Entertainment': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'Gaming': 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    'Social': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'Relaxation': 'bg-green-500/20 text-green-400 border-green-500/50',
    'Adventure': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  };
  return colors[category] || colors['Entertainment'];
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemedRewards, setRedeemedRewards] = useState<RedeemedReward[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [ranks, setRanks] = useState<RankDefinition[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    cost: 1,
    category: 'Entertainment',
    description: '',
    minLevel: 1,
    minRankId: null as string | null,
    minDisciplineScore: 20,
    cooldownHours: 0,
    maxRedemptionsPerWeek: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [profileRes, ranksRes, rewardsRes] = await Promise.all([
          fetch('/api/user-profile'),
          fetch('/api/ranks'),
          fetch('/api/rewards'),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserState({
            level: profile.level,
            rankName: profile.rank,
            rankCode: profile.rankCode ?? null,
            currentRankId: profile.currentRankId ?? null,
            points: profile.points ?? 0,
            disciplineScore: profile.disciplineScore ?? 0,
          });
        }

        if (ranksRes.ok) {
          const { ranks: ranksData } = await ranksRes.json();
          setRanks(
            (ranksData || []).map((r: any) => ({
              id: r.id,
              code: r.code,
              name: r.name,
            })),
          );
        }

        if (rewardsRes.ok) {
          const { rewards: rewardsData } = await rewardsRes.json();
          setRewards(
            (rewardsData || []).map((r: any) => ({
              id: String(r.id),
              name: r.name,
              cost: r.point_cost,
              category: r.category || 'General',
              description: r.description || '',
              minLevel: r.minimum_level || 1,
              minRankId: r.minimum_rank_id || null,
              minRankCode: r.minimum_rank?.code || null,
              minDisciplineScore: r.minimum_discipline_score || 0,
              cooldownHours: r.cooldown_hours || 0,
              maxRedemptionsPerWeek: r.max_redemptions_per_week ?? null,
            })),
          );
        }
      } catch (error) {
        console.error('[v0] Error loading rewards data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Helper functions
  const compareRanksById = (userRankId: string | null, minRankId: string | null): boolean => {
    if (!userRankId || !minRankId) return false;
    if (!ranks.length) return false;

    const orderedIds = ranks.map(r => r.id);
    const userIndex = orderedIds.indexOf(userRankId);
    const minIndex = orderedIds.indexOf(minRankId);

    if (userIndex === -1 || minIndex === -1) return false;

    return userIndex >= minIndex;
  };

  const isRewardUnlocked = (reward: Reward): boolean => {
    if (!userState) return false;
    return (
      userState.level >= reward.minLevel &&
      compareRanksById(userState.currentRankId, reward.minRankId) &&
      userState.disciplineScore >= reward.minDisciplineScore
    );
  };

  const canRedeem = (reward: Reward): boolean => {
    if (!userState) return false;
    return isRewardUnlocked(reward) && userState.points >= reward.cost;
  };

  const getRequirementErrors = (reward: Reward): string[] => {
    const errors: string[] = [];

    if (!userState) {
      errors.push('User data not loaded yet');
      return errors;
    }

    if (userState.level < reward.minLevel) {
      errors.push(`Level ${reward.minLevel} required (you have ${userState.level})`);
    }
    if (!compareRanksById(userState.currentRankId, reward.minRankId)) {
      const requiredRank =
        ranks.find(r => r.id === reward.minRankId)?.code || reward.minRankCode || 'Rank';
      const userRank = userState.rankCode || userState.rankName;
      errors.push(`${requiredRank}-Rank required (you have ${userRank})`);
    }
    if (userState.disciplineScore < reward.minDisciplineScore) {
      errors.push(
        `${reward.minDisciplineScore}% discipline required (you have ${userState.disciplineScore}%)`,
      );
    }
    if (userState.points < reward.cost) {
      errors.push(`${reward.cost} points required (you have ${userState.points})`);
    }
    return errors;
  };

  // Event handlers
  const handleCreateReward = async () => {
    if (!formData.name.trim()) return;

    try {
      const response = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          pointCost: formData.cost,
          minimumLevel: formData.minLevel,
          minimumRankId: formData.minRankId || null,
          minimumDisciplineScore: formData.minDisciplineScore,
          cooldownHours: formData.cooldownHours,
          maxRedemptionsPerWeek: formData.maxRedemptionsPerWeek,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create reward');
      }

      const { reward } = await response.json();

      const normalized: Reward = {
        id: String(reward.id),
        name: reward.name,
        cost: reward.point_cost,
        category: reward.category || 'General',
        description: reward.description || '',
        minLevel: reward.minimum_level || 1,
        minRankId: reward.minimum_rank_id || null,
        minRankCode: reward.minimum_rank?.code || null,
        minDisciplineScore: reward.minimum_discipline_score || 0,
        cooldownHours: reward.cooldown_hours || 0,
        maxRedemptionsPerWeek: reward.max_redemptions_per_week ?? null,
      };

      setRewards(prev => [...prev, normalized]);

      setFormData({
        name: '',
        cost: 1,
        category: 'Entertainment',
        description: '',
        minLevel: 1,
        minRankId: ranks[0]?.id ?? null,
        minDisciplineScore: 20,
        cooldownHours: 0,
        maxRedemptionsPerWeek: 0,
      });
      setIsCreateOpen(false);
    } catch (error) {
      console.error('[v0] Error creating reward:', error);
      alert(error instanceof Error ? error.message : 'Failed to create reward');
    }
  };

  const handleRedeem = async (reward: Reward) => {
    if (!canRedeem(reward)) return;
    try {
      const response = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to redeem reward');
      }

      const { redemption, newBalance } = await response.json();

      const redeemedReward: RedeemedReward = {
        id: redemption.id,
        rewardId: Number(reward.id),
        name: reward.name,
        cost: reward.cost,
        redeemedAt: new Date(redemption.redeemed_at ?? Date.now()),
      };

      setRedeemedRewards(prev => [...prev, redeemedReward]);
      setUserState(prev =>
        prev
          ? {
              ...prev,
              points: newBalance,
            }
          : prev,
      );
    } catch (error) {
      console.error('[v0] Error redeeming reward:', error);
      alert(error instanceof Error ? error.message : 'Failed to redeem reward');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="md:ml-64 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-3xl font-bold">Rewards Store</h1>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Card className="border-border bg-card/50 backdrop-blur p-4 flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Current Points</div>
                  <div className="flex items-center gap-2">
                    <Zap size={20} className="text-secondary" />
                    <div className="text-3xl font-bold text-secondary">
                      {userState ? userState.points : '—'}
                    </div>
                  </div>
                </Card>
                <Card className="border-border bg-card/50 backdrop-blur p-4 flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Level</div>
                  <div className="text-3xl font-bold text-primary">
                    {userState ? userState.level : '—'}
                  </div>
                </Card>
                <Card className="border-border bg-card/50 backdrop-blur p-4 flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Rank</div>
                  <div className="text-3xl font-bold text-accent">
                    {userState ? userState.rankCode || userState.rankName : '—'}
                  </div>
                </Card>
                <Card className="border-border bg-card/50 backdrop-blur p-4 flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Discipline</div>
                  <div className="text-3xl font-bold text-secondary">
                    {userState ? `${userState.disciplineScore}%` : '—'}
                  </div>
                </Card>
              </div>
            </div>

            <Tabs defaultValue="available" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-card/50 border border-border">
                  <TabsTrigger value="available">Available ({rewards.length})</TabsTrigger>
                  <TabsTrigger value="redeemed">Redeemed ({redeemedRewards.length})</TabsTrigger>
                </TabsList>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/30">
                      <Plus className="w-4 h-4" />
                      Create Reward
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card/95 border-border/50 backdrop-blur-md max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Reward</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-foreground">Reward Name</label>
                        <Input
                          placeholder="Enter reward name..."
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="mt-1 bg-card/50 border-border/30"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Cost (Points)</label>
                          <Input
                            type="number"
                            min="1"
                            value={formData.cost}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                cost: Number(e.target.value) || 0,
                              })
                            }
                            className="mt-1 bg-card/50 border-border/30"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Category</label>
                          <Select 
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                          >
                            <SelectTrigger className="mt-1 bg-card/50 border-border/30">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Entertainment" className="cursor-pointer">Entertainment</SelectItem>
                              <SelectItem value="Gaming" className="cursor-pointer">Gaming</SelectItem>
                              <SelectItem value="Social" className="cursor-pointer">Social</SelectItem>
                              <SelectItem value="Relaxation" className="cursor-pointer">Relaxation</SelectItem>
                              <SelectItem value="Adventure" className="cursor-pointer">Adventure</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground">Description</label>
                        <Input
                          placeholder="What is this reward?"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="mt-1 bg-card/50 border-border/30"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Min Level</label>
                          <Input
                            type="number"
                            min="1"
                            value={formData.minLevel}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                minLevel: Number(e.target.value) || 1,
                              })
                            }
                            className="mt-1 bg-card/50 border-border/30"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Min Rank</label>
                          <Select 
                            value={formData.minRankId || undefined}
                            onValueChange={(value) => setFormData({ ...formData, minRankId: value })}
                          >
                            <SelectTrigger className="mt-1 bg-card/50 border-border/30">
                              <SelectValue placeholder="Select rank" />
                            </SelectTrigger>
                            <SelectContent>
                              {ranks.map(rank => (
                                <SelectItem
                                  key={rank.id}
                                  value={rank.id}
                                  className="cursor-pointer"
                                >
                                  {rank.code || rank.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Min Discipline</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.minDisciplineScore}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                minDisciplineScore: Number(e.target.value) || 0,
                              })
                            }
                            className="mt-1 bg-card/50 border-border/30"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground">Cooldown (hours)</label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.cooldownHours}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cooldownHours: Number(e.target.value) || 0,
                            })
                          }
                          className="mt-1 bg-card/50 border-border/30"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground">Max Redemptions / Week</label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.maxRedemptionsPerWeek}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxRedemptionsPerWeek: Number(e.target.value) || 0,
                            })
                          }
                          className="mt-1 bg-card/50 border-border/30"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          className="bg-secondary/20 hover:bg-secondary/30 text-secondary"
                          onClick={handleCreateReward}
                          disabled={!formData.name.trim()}
                        >
                          Create Reward
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <TabsContent value="available" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {rewards.map((reward) => {
                  const isUnlocked = isRewardUnlocked(reward);
                  const canRedeemedNow = canRedeem(reward);
                  const errors = getRequirementErrors(reward);

                  return (
                    <Card
                      key={reward.id}
                      className={`border rounded-xl backdrop-blur card-glow p-6 flex flex-col relative transition-all ${
                        isUnlocked
                          ? 'border-border/50 bg-card/50 hover:border-primary/50'
                          : 'border-muted/30 bg-card/30 opacity-60'
                      }`}
                    >
                      {/* Lock/Unlock Badge */}
                      <div className="absolute top-3 right-3">
                        {isUnlocked ? (
                          <div className="bg-primary/20 border border-primary/30 rounded-full p-2">
                            <Unlock size={14} className="text-primary" />
                          </div>
                        ) : (
                          <div className="bg-destructive/20 border border-destructive/30 rounded-full p-2">
                            <Lock size={14} className="text-destructive" />
                          </div>
                        )}
                      </div>

                      <div className="mb-4 pr-8">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift size={18} className={isUnlocked ? 'text-primary' : 'text-muted-foreground'} />
                          <h3 className="text-lg font-semibold">{reward.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{reward.description}</p>
                        <Badge className={`text-xs ${getCategoryColor(reward.category)}`}>
                          {reward.category}
                        </Badge>
                      </div>

                      {/* Requirements Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-4 text-xs p-3 bg-card/50 rounded-lg border border-border/20">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Level</p>
                          <p
                            className={`font-semibold ${
                              userState && userState.level >= reward.minLevel
                                ? 'text-primary'
                                : 'text-destructive'
                            }`}
                          >
                            {reward.minLevel}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Rank</p>
                          <p
                            className={`font-semibold ${
                              userState && compareRanksById(userState.currentRankId, reward.minRankId)
                                ? 'text-primary'
                                : 'text-destructive'
                            }`}
                          >
                            {reward.minRankCode ||
                              ranks.find(r => r.id === reward.minRankId)?.code ||
                              '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Discipline</p>
                          <p
                            className={`font-semibold ${
                              userState &&
                              userState.disciplineScore >= reward.minDisciplineScore
                                ? 'text-primary'
                                : 'text-destructive'
                            }`}
                          >
                            {reward.minDisciplineScore}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Cost</p>
                          <div className="flex items-center gap-0.5">
                            <Zap
                              size={12}
                              className={
                                userState && userState.points >= reward.cost
                                  ? 'text-primary'
                                  : 'text-destructive'
                              }
                            />
                            <p
                              className={`font-semibold ${
                                userState && userState.points >= reward.cost
                                  ? 'text-primary'
                                  : 'text-destructive'
                              }`}
                            >
                              {reward.cost}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Cooldown */}
                      <div className="text-sm mb-4 text-muted-foreground">
                        <span className="text-xs uppercase">Cooldown:</span>{' '}
                        {reward.cooldownHours ? `${reward.cooldownHours}h` : 'No cooldown'}
                      </div>

                      {reward.maxRedemptionsPerWeek !== null && (
                        <div className="text-xs mb-4 text-muted-foreground">
                          Max {reward.maxRedemptionsPerWeek}x per week
                        </div>
                      )}

                      {/* Error Messages */}
                      {errors.length > 0 && !isUnlocked && (
                        <div className="mb-4 text-xs text-destructive/80 space-y-0.5">
                          {errors.map((error, idx) => (
                            <p key={idx}>• {error}</p>
                          ))}
                        </div>
                      )}

                      {/* Redeem Button */}
                      <Button
                        disabled={!canRedeemedNow}
                        onClick={() => handleRedeem(reward)}
                        className={
                          canRedeemedNow
                            ? 'w-full bg-primary hover:bg-primary/90 text-primary-foreground'
                            : 'w-full opacity-50 cursor-not-allowed'
                        }
                        title={!isUnlocked ? errors.join('\n') : !canRedeemedNow ? errors.join('\n') : 'Redeem this reward'}
                      >
                        {isUnlocked ? (canRedeemedNow ? 'Redeem' : 'Not Enough Points') : 'Locked'}
                      </Button>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="redeemed" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {redeemedRewards.length > 0 ? (
                  redeemedRewards.map((redeemed) => (
                    <Card
                      key={redeemed.id}
                      className="border-border bg-card/50 backdrop-blur p-6 opacity-80"
                    >
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift size={18} className="text-secondary" />
                          <h3 className="text-lg font-semibold">{redeemed.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Redeemed on {redeemed.redeemedAt.toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Zap size={16} className="text-secondary" />
                          <span className="text-lg font-bold">-{redeemed.cost}</span>
                        </div>
                        <Badge className="bg-accent/20 text-accent">✓ Redeemed</Badge>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <p className="text-muted-foreground">No redeemed rewards yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
