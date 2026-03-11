'use client';

import { Zap, Shield, Gem, AlertCircle, Crown, Flame } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface HeroStatusProps {
  name?: string;
  level?: number;
  rank?: string;
  currentXP?: number;
  xpToNextLevel?: number;
  xpThisWeek?: number;
  availablePoints?: number;
  disciplineScore?: number;
  activePenalties?: number;
  streak?: number;
  loading?: boolean;
}

export function HeroStatus(props: HeroStatusProps) {
  const hasData = props.name != null || props.level != null;
  const name = hasData ? (props.name ?? 'User') : 'Alex Hunter';
  const level = hasData ? (props.level ?? 1) : 7;
  const rank = hasData ? (props.rank ?? 'F-Rank') : 'B-Rank Grinder';
  const currentXP = hasData ? (props.currentXP ?? 0) : 4250;
  const xpToNext = hasData ? (props.xpToNextLevel ?? 100) : 5000;
  const xpThisWeek = hasData ? (props.xpThisWeek ?? 0) : 485;
  const points = hasData ? (props.availablePoints ?? 0) : 42;
  const discipline = hasData ? (props.disciplineScore ?? 0) : 92;
  const penalties = hasData ? (props.activePenalties ?? 0) : 0;
  const streak = hasData ? (props.streak ?? 0) : 12;
  const loading = props.loading ?? false;

  const progressPct = xpToNext > 0 ? Math.min(100, Math.round((currentXP / xpToNext) * 100)) : 0;
  const nextIn = Math.max(0, xpToNext - currentXP);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="lg:col-span-2 bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 rounded-xl p-6 card-glow relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-small-white/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Character Status
              </p>
              <h2 className="text-3xl font-bold text-foreground">
                {loading ? '…' : name}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <Crown size={16} className="text-accent" />
                <span className="text-sm font-semibold text-accent">{rank}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-primary glow-accent">{loading ? '—' : level}</div>
              <p className="text-xs text-muted-foreground">LEVEL</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-foreground">Current XP</label>
                <span className="text-xs text-muted-foreground">
                  {loading ? '—' : `${currentXP.toLocaleString()} / ${xpToNext.toLocaleString()}`}
                </span>
              </div>
              <Progress value={loading ? 0 : progressPct} className="h-2 bg-card border border-border/30" />
            </div>
            <p className="text-xs text-muted-foreground">
              Next level in <span className="text-accent font-semibold">{loading ? '—' : `${nextIn.toLocaleString()} XP`}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-4 card-glow">
        <div className="flex items-center justify-between mb-3">
          <Zap size={18} className="text-accent" />
          <span className="text-xs font-semibold text-accent uppercase">XP</span>
        </div>
        <p className="text-2xl font-bold text-foreground mb-1">{loading ? '—' : xpThisWeek.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">This week</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-4 card-glow">
        <div className="flex items-center justify-between mb-3">
          <Gem size={18} className="text-primary" />
          <span className="text-xs font-semibold text-primary uppercase">Points</span>
        </div>
        <p className="text-2xl font-bold text-foreground mb-1">{loading ? '—' : points}</p>
        <p className="text-xs text-muted-foreground">Available</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-4 card-glow">
        <div className="flex items-center justify-between mb-3">
          <Shield size={18} className="text-secondary" />
          <span className="text-xs font-semibold text-secondary uppercase">Score</span>
        </div>
        <p className="text-2xl font-bold text-foreground mb-1">{loading ? '—' : `${discipline}%`}</p>
        <p className="text-xs text-muted-foreground">Discipline</p>
      </div>

      <div className="bg-card border border-destructive/30 rounded-xl p-4 card-glow">
        <div className="flex items-center justify-between mb-3">
          <AlertCircle size={18} className="text-destructive" />
          <span className="text-xs font-semibold text-destructive uppercase">Penalty</span>
        </div>
        <p className="text-2xl font-bold text-foreground mb-1">{loading ? '—' : penalties}</p>
        <p className="text-xs text-muted-foreground">Active penalties</p>
      </div>

      <div className="bg-card border border-accent/30 rounded-xl p-4 card-glow">
        <div className="flex items-center justify-between mb-3">
          <Flame size={18} className="text-accent" />
          <span className="text-xs font-semibold text-accent uppercase">Streak</span>
        </div>
        <p className="text-2xl font-bold text-foreground mb-1">{loading ? '—' : streak}</p>
        <p className="text-xs text-muted-foreground">Days active</p>
      </div>
    </div>
  );
}
