'use client';

import { AlertTriangle, Clock, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export interface ActivePenaltyItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  due_at: string | null;
  penalty_definitions?: { severity_order?: number }[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'text-destructive';
    case 'warning':
      return 'text-amber-500';
    default:
      return 'text-destructive';
  }
};

const getSeverityLabel = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'CRITICAL';
    case 'warning':
      return 'WARNING';
    default:
      return 'PENALTY';
  }
};

const getSeverityBadgeColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-destructive/20 text-destructive border-destructive/50';
    case 'warning':
      return 'bg-amber-500/20 text-amber-500 border-amber-500/50';
    default:
      return 'bg-destructive/20 text-destructive border-destructive/50';
  }
};

function formatDue(dueAt: string | null) {
  if (!dueAt) return '—';
  const d = new Date(dueAt);
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

interface PenaltySystemProps {
  activePenalties?: ActivePenaltyItem[];
  onMarkDone?: (penaltyId: string) => void;
  loading?: boolean;
}

export function PenaltySystem({ activePenalties: propPenalties, onMarkDone, loading }: PenaltySystemProps) {
  const list = Array.isArray(propPenalties) ? propPenalties : [];
  const hasRealData = Array.isArray(propPenalties);

  if (loading && hasRealData) {
    return (
      <section className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Active Penalties</h2>
        <div className="bg-card border border-border/50 rounded-xl p-8 text-center text-muted-foreground card-glow">
          Loading…
        </div>
      </section>
    );
  }

  if (list.length === 0) {
    return (
      <section className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Active Penalties</h2>
        <div className="bg-card border border-accent/30 rounded-xl p-8 text-center card-glow">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/20 mb-3">
            <AlertTriangle size={24} className="text-accent" />
          </div>
          <p className="text-foreground font-semibold mb-1">No Active Penalties</p>
          <p className="text-muted-foreground text-sm mb-4">Keep your discipline high to maintain this status!</p>
          <Link href="/penalties">
            <Button variant="outline" size="sm" className="gap-2">
              View penalties page
              <ChevronRight size={16} />
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Active Penalties</h2>
        <Link href="/penalties">
          <Button variant="outline" size="sm" className="gap-2">
            View All
            <ChevronRight size={16} />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {list.map((penalty) => {
          const severity = (penalty.penalty_definitions?.[0]?.severity_order != null && penalty.penalty_definitions[0].severity_order > 1) ? 'warning' : 'critical';
          return (
            <div key={penalty.id} className="bg-card border border-destructive/30 rounded-xl p-6 card-glow">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle size={20} className={`flex-shrink-0 mt-1 ${getSeverityColor(severity)}`} />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-1">{penalty.title}</h3>
                      {penalty.description && (
                        <p className="text-sm text-muted-foreground">{penalty.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={`flex-shrink-0 ${getSeverityBadgeColor(severity)} border`}>
                    {getSeverityLabel(severity)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">DUE</p>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-destructive" />
                      <p className="text-sm font-semibold text-foreground">{formatDue(penalty.due_at)}</p>
                    </div>
                  </div>
                </div>

                {onMarkDone && (
                  <div className="pt-2">
                    <Button
                      onClick={() => onMarkDone(penalty.id)}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                    >
                      <CheckCircle size={16} />
                      Mark as Done
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
