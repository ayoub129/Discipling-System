'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertTriangle, Clock, CheckCircle2, Zap, Plus } from 'lucide-react';

interface Penalty {
  id: string;
  title: string;
  description: string;
  severityOrder: number;
  issuedAt: string;
  dueAt: string | null;
  baseStatus: 'created' | 'in-progress' | 'done' | 'expired';
  xpLossIfMissed: number;
  xpLost: number;
  triggerPoints: number;
}

type DisplayStatus = 'active' | 'due-soon' | 'expired' | 'completed';

const getSeverityColor = (severityOrder: number) => {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  };
  if (severityOrder >= 4) return colors.critical;
  if (severityOrder === 3) return colors.high;
  if (severityOrder === 2) return colors.medium;
  return colors.low;
};

const getStatusBadge = (status: DisplayStatus) => {
  const badges: Record<
    DisplayStatus,
    { color: string; label: string; icon: React.ReactNode }
  > = {
    active: {
      color: 'bg-primary/20 text-primary border-primary/30',
      label: 'Active',
      icon: <Clock size={12} />,
    },
    'due-soon': {
      color: 'bg-red-500/20 text-red-400 border-red-500/50',
      label: 'Due Soon',
      icon: <AlertTriangle size={12} />,
    },
    expired: {
      color: 'bg-destructive/20 text-destructive border-destructive/30',
      label: 'Expired',
      icon: <AlertTriangle size={12} />,
    },
    completed: {
      color: 'bg-accent/20 text-accent border-accent/30',
      label: 'Completed',
      icon: <CheckCircle2 size={12} />,
    },
  };
  return badges[status];
};

export default function PenaltiesPage() {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalDefinitions, setTotalDefinitions] = useState(0);
  const [totalXpLost, setTotalXpLost] = useState(0);
  const [penaltyPoints, setPenaltyPoints] = useState(0);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'high' as 'low' | 'medium' | 'high' | 'critical',
    triggerPoints: 100,
    xpLossIfMissed: 50,
    dueInHours: 24,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [penaltiesRes, profileRes] = await Promise.all([
          fetch('/api/penalties'),
          fetch('/api/user-profile'),
        ]);

        if (penaltiesRes.ok) {
          const data = await penaltiesRes.json();
          setTotalDefinitions(data.stats?.totalDefinitions ?? 0);
          setTotalXpLost(data.stats?.totalXpLost ?? 0);

          const mapped: Penalty[] = (data.userPenalties || []).map((p: any) => ({
            id: String(p.id),
            title: p.title,
            description: p.description || '',
            severityOrder: p.penalty_definitions?.severity_order ?? 1,
            issuedAt: p.issued_at,
            dueAt: p.due_at,
            baseStatus: p.status,
            xpLossIfMissed: p.penalty_definitions?.xp_loss_if_missed ?? 0,
            xpLost: p.xp_lost ?? 0,
            triggerPoints: p.penalty_definitions?.trigger_points ?? 0,
          }));

          setPenalties(mapped);
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setPenaltyPoints(profile.penaltyPoints ?? 0);
        }
      } catch (error) {
        console.error('[v0] Error loading penalties data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const computeDisplayStatus = (penalty: Penalty): DisplayStatus => {
    if (penalty.baseStatus === 'done') return 'completed';
    if (penalty.baseStatus === 'expired') return 'expired';

    if (penalty.dueAt) {
      const now = new Date();
      const due = new Date(penalty.dueAt);
      const diffMs = due.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours <= 0) {
        return 'expired';
      }
      if (diffHours <= 1) {
        return 'due-soon';
      }
    }

    return 'active';
  };

  const activePenalties = useMemo(
    () =>
      penalties.filter(p =>
        ['created', 'in-progress'].includes(p.baseStatus),
      ),
    [penalties],
  );

  const handleCreatePenalty = async () => {
    if (!formData.title.trim() || !formData.description.trim()) return;

    try {
      const severityOrder =
        formData.severity === 'critical'
          ? 4
          : formData.severity === 'high'
          ? 3
          : formData.severity === 'medium'
          ? 2
          : 1;

      const response = await fetch('/api/penalties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          severityOrder,
          triggerPoints: formData.triggerPoints,
          xpLossIfMissed: formData.xpLossIfMissed,
          dueInHours: formData.dueInHours,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create penalty');
      }

      const userPenalty = data.userPenalty;

      const newPenalty: Penalty = {
        id: String(userPenalty.id),
        title: userPenalty.title,
        description: userPenalty.description || '',
        severityOrder:
          userPenalty.penalty_definitions?.severity_order ?? severityOrder,
        issuedAt: userPenalty.issued_at,
        dueAt: userPenalty.due_at,
        baseStatus: userPenalty.status,
        xpLossIfMissed:
          userPenalty.penalty_definitions?.xp_loss_if_missed ??
          formData.xpLossIfMissed,
        xpLost: userPenalty.xp_lost ?? 0,
        triggerPoints:
          userPenalty.penalty_definitions?.trigger_points ??
          formData.triggerPoints,
      };

      setPenalties(prev => [newPenalty, ...prev]);
      setTotalDefinitions(prev => prev + 1);

      setFormData({
        title: '',
        description: '',
        severity: 'high',
        triggerPoints: 100,
        xpLossIfMissed: 50,
        dueInHours: 24,
      });
      setIsCreateOpen(false);
    } catch (error) {
      console.error('[v0] Error creating penalty:', error);
      alert(error instanceof Error ? error.message : 'Failed to create penalty');
    }
  };

  const handleActivate = async (penalty: Penalty) => {
    try {
      const response = await fetch('/api/penalties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: penalty.id, action: 'activate' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate penalty');
      }

      setPenalties(prev =>
        prev.map(p =>
          p.id === penalty.id ? { ...p, baseStatus: 'in-progress' } : p,
        ),
      );
    } catch (error) {
      console.error('[v0] Error activating penalty:', error);
      alert(error instanceof Error ? error.message : 'Failed to activate penalty');
    }
  };

  const handleComplete = async (penalty: Penalty) => {
    try {
      const response = await fetch('/api/penalties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: penalty.id, action: 'complete' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete penalty');
      }

      setPenalties(prev =>
        prev.map(p =>
          p.id === penalty.id
            ? {
                ...p,
                baseStatus:
                  data.status === 'expired' ? 'expired' : ('done' as const),
                xpLost:
                  typeof data.xpLost === 'number' ? data.xpLost : p.xpLost,
              }
            : p,
        ),
      );

      if (typeof data.penaltyPoints === 'number') {
        setPenaltyPoints(data.penaltyPoints);
      }
      if (typeof data.xpLost === 'number') {
        setTotalXpLost(prev => prev + data.xpLost);
      }
    } catch (error) {
      console.error('[v0] Error completing penalty:', error);
      alert(error instanceof Error ? error.message : 'Failed to complete penalty');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-primary to-secondary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading penalties...</p>
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
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Penalty System</h1>
              <p className="text-muted-foreground">
                Consequences for failing to maintain discipline and complete your commitments
              </p>
            </div>

            <Card className="border-destructive/30 bg-destructive/5 backdrop-blur p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive mb-1">Penalty Status</h3>
                <p className="text-sm text-muted-foreground">
                  You currently have <span className="font-semibold">{activePenalties.length}</span>{' '}
                  active penalties. Complete them before they become due to avoid XP loss.
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="border-border bg-card/50 backdrop-blur p-6">
                <div className="text-sm text-muted-foreground mb-2">Total Penalties</div>
                <div className="text-3xl font-bold text-destructive">{totalDefinitions}</div>
              </Card>
              <Card className="border-border bg-card/50 backdrop-blur p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Zap size={14} />
                  <span>Total XP Loss</span>
                </div>
                <div className="text-3xl font-bold text-orange-400">-{totalXpLost}</div>
              </Card>
              <Card className="border-border bg-card/50 backdrop-blur p-6">
                <div className="text-sm text-muted-foreground mb-2">Penalty Points</div>
                <div className="text-3xl font-bold text-secondary">{penaltyPoints}</div>
              </Card>
            </div>

            <Tabs defaultValue="active" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-card/50 border border-border">
                  <TabsTrigger value="active">Active ({activePenalties.length})</TabsTrigger>
                  <TabsTrigger value="all">All Penalties ({penalties.length})</TabsTrigger>
                </TabsList>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/30">
                      <Plus className="w-4 h-4" />
                      Create Penalty
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card/95 border-border/50 backdrop-blur-md max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Penalty Rule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-foreground">Penalty Title</label>
                        <Input
                          placeholder="e.g., Extra 2 Hour Deep Work"
                          value={formData.title}
                          onChange={e => setFormData({ ...formData, title: e.target.value })}
                          className="mt-1 bg-card/50 border-border/30"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground">Description</label>
                        <Input
                          placeholder="What is this penalty?"
                          value={formData.description}
                          onChange={e => setFormData({ ...formData, description: e.target.value })}
                          className="mt-1 bg-card/50 border-border/30"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Severity</label>
                          <Select
                            value={formData.severity}
                            onValueChange={value =>
                              setFormData({ ...formData, severity: value as typeof formData.severity })
                            }
                          >
                            <SelectTrigger className="mt-1 bg-card/50 border-border/30">
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low" className="cursor-pointer">
                                Low
                              </SelectItem>
                              <SelectItem value="medium" className="cursor-pointer">
                                Medium
                              </SelectItem>
                              <SelectItem value="high" className="cursor-pointer">
                                High
                              </SelectItem>
                              <SelectItem value="critical" className="cursor-pointer">
                                Critical
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Trigger Points</label>
                          <p className="text-xs text-muted-foreground mb-1">
                            Penalty points required to activate this penalty
                          </p>
                          <Input
                            type="number"
                            min={1}
                            value={formData.triggerPoints}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                triggerPoints: parseInt(e.target.value) || 1,
                              })
                            }
                            className="mt-1 bg-card/50 border-border/30"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">XP Loss if Missed</label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.xpLossIfMissed}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                xpLossIfMissed: parseInt(e.target.value) || 0,
                              })
                            }
                            className="mt-1 bg-card/50 border-border/30"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground">Due In (hours)</label>
                        <Input
                          type="number"
                          min={1}
                          value={formData.dueInHours}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              dueInHours: parseInt(e.target.value) || 1,
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
                          onClick={handleCreatePenalty}
                          disabled={!formData.title.trim() || !formData.description.trim()}
                        >
                          Create Penalty
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <TabsContent value="active" className="space-y-4 mt-6">
                {activePenalties.length > 0 ? (
                  activePenalties.map(penalty => {
                    const displayStatus = computeDisplayStatus(penalty);
                    const statusBadge = getStatusBadge(displayStatus);

                    return (
                      <Card
                        key={penalty.id}
                        className={`border-border bg-card/50 backdrop-blur card-glow p-6 transition-all ${
                          displayStatus === 'due-soon' ? 'border-red-500/50' : 'hover:border-primary/50'
                        }`}
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold mb-1">{penalty.title}</h3>
                                <p className="text-sm text-muted-foreground">{penalty.description}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
                              <Badge className={getSeverityColor(penalty.severityOrder)}>
                                Severity {penalty.severityOrder}
                              </Badge>
                              <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs p-3 bg-card/50 rounded-lg border border-border/20">
                            <div>
                              <p className="text-muted-foreground mb-1">Issued</p>
                              <p className="font-semibold text-foreground">
                                {new Date(penalty.issuedAt).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Due</p>
                              <p
                                className={`font-semibold ${
                                  displayStatus === 'due-soon' ? 'text-red-400' : 'text-foreground'
                                }`}
                              >
                                {penalty.dueAt ? new Date(penalty.dueAt).toLocaleString() : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Status</p>
                              <p className="font-semibold text-foreground capitalize">{displayStatus}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 p-3 bg-card/50 border border-border/20 rounded-lg text-xs">
                            <Zap size={14} className="text-orange-400 flex-shrink-0" />
                            <span className="text-muted-foreground">
                              XP Loss if missed:{' '}
                              <span className="font-semibold text-orange-400">
                                -{penalty.xpLossIfMissed}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/20">
                            {penalty.baseStatus === 'created' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={() => handleActivate(penalty)}
                              >
                                <Clock size={16} />
                                Activate Penalty
                              </Button>
                            )}
                            {['created', 'in-progress'].includes(penalty.baseStatus) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={() => handleComplete(penalty)}
                              >
                                <CheckCircle2 size={16} />
                                Mark as Completed
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 size={48} className="mx-auto text-accent mb-3 opacity-50" />
                    <p className="text-muted-foreground">
                      No active penalties. Great job maintaining discipline!
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-4 mt-6">
                {penalties.length > 0 ? (
                  penalties.map(penalty => {
                    const displayStatus = computeDisplayStatus(penalty);
                    const statusBadge = getStatusBadge(displayStatus);
                    const isActive = ['created', 'in-progress'].includes(penalty.baseStatus);

                    return (
                      <Card
                        key={penalty.id}
                        className={`border-border bg-card/50 backdrop-blur card-glow p-6 transition-all ${
                          isActive ? 'hover:border-primary/50' : 'opacity-70'
                        } ${displayStatus === 'due-soon' ? 'border-red-500/50' : ''}`}
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              {isActive ? (
                                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                              ) : (
                                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                              )}
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold mb-1">{penalty.title}</h3>
                                <p className="text-sm text-muted-foreground">{penalty.description}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
                              <Badge className={getSeverityColor(penalty.severityOrder)}>
                                Severity {penalty.severityOrder}
                              </Badge>
                              <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs p-3 bg-card/50 rounded-lg border border-border/20">
                            <div>
                              <p className="text-muted-foreground mb-1">Issued</p>
                              <p className="font-semibold text-foreground">
                                {new Date(penalty.issuedAt).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Due</p>
                              <p
                                className={`font-semibold ${
                                  displayStatus === 'due-soon' ? 'text-red-400' : 'text-foreground'
                                }`}
                              >
                                {penalty.dueAt ? new Date(penalty.dueAt).toLocaleString() : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Status</p>
                              <p className="font-semibold text-foreground capitalize">{displayStatus}</p>
                            </div>
                          </div>

                          {penalty.triggerPoints > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-card/50 border border-border/20 rounded-lg text-xs">
                              <Zap size={14} className="text-secondary flex-shrink-0" />
                              <span className="text-muted-foreground">
                                Requires{' '}
                                <span className="font-semibold text-secondary">
                                  {penalty.triggerPoints} penalty points
                                </span>{' '}
                                to activate
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 p-3 bg-card/50 border border-border/20 rounded-lg text-xs">
                            <Zap size={14} className="text-orange-400 flex-shrink-0" />
                            <span className="text-muted-foreground">
                              XP Loss if missed:{' '}
                              <span className="font-semibold text-orange-400">
                                -{penalty.xpLossIfMissed}
                              </span>
                            </span>
                          </div>

                          {isActive && (
                            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/20">
                              {penalty.baseStatus === 'created' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => handleActivate(penalty)}
                                >
                                  <Clock size={16} />
                                  Activate Penalty
                                </Button>
                              )}
                              {['created', 'in-progress'].includes(penalty.baseStatus) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => handleComplete(penalty)}
                                >
                                  <CheckCircle2 size={16} />
                                  Mark as Completed
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No penalties created yet</p>
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

