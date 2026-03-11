'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

type QuestStatus = 'pending' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';

interface Quest {
  id: string;
  title: string;
  description: string | null;
  date: string; // ISO date string (YYYY-MM-DD)
  planned_start: string | null;
  planned_end: string | null;
  status: QuestStatus;
  xp_reward: number;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quests, setQuests] = useState<Quest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streakDays, setStreakDays] = useState<number | null>(null);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarGrid = [];
  for (let i = 0; i < firstDay; i++) {
    calendarGrid.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarGrid.push(i);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === currentDate.getFullYear() && today.getMonth() === currentDate.getMonth();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-accent';
      case 'in-progress':
        return 'text-primary';
      case 'delayed':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'work':
        return 'bg-primary/10 border-primary/30';
      case 'health':
        return 'bg-accent/10 border-accent/30';
      case 'learning':
        return 'bg-secondary/10 border-secondary/30';
      default:
        return 'bg-secondary/10 border-secondary/30';
    }
  };

  // Fetch quests + streak data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [questsRes, profileRes] = await Promise.all([
          fetch('/api/quests'),
          fetch('/api/user-profile'),
        ]);

        if (questsRes.ok) {
          const data = await questsRes.json();
          setQuests(data.quests || []);
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setStreakDays(profile.streakDays ?? null);
        }
      } catch (error) {
        console.error('[v0] Error loading calendar data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Group quests by date (YYYY-MM-DD)
  const questsByDate = useMemo(() => {
    const map: Record<string, Quest[]> = {};
    for (const q of quests) {
      if (!map[q.date]) map[q.date] = [];
      map[q.date].push(q);
    }
    return map;
  }, [quests]);

  const formatDateKey = (date: Date, day: number) => {
    const d = new Date(date.getFullYear(), date.getMonth(), day);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const selectedDateKey = selectedDate.toISOString().split('T')[0];
  const selectedDayQuests = questsByDate[selectedDateKey] || [];
  const selectedCompleted = selectedDayQuests.filter(
    q => q.status === 'completed',
  ).length;
  const selectedTotal = selectedDayQuests.length;
  const selectedTotalXP = selectedDayQuests.reduce(
    (sum, q) => sum + (q.xp_reward || 0),
    0,
  );

  const monthKeyPrefix = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1,
  ).padStart(2, '0')}-`;
  const monthQuests = quests.filter(q => q.date.startsWith(monthKeyPrefix));
  const monthTotal = monthQuests.length;
  const monthCompleted = monthQuests.filter(
    q => q.status === 'completed',
  ).length;
  const monthRate =
    monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 1000) / 10 : 0;

  const isQuestDelayed = (quest: Quest) => {
    if (!quest.planned_end) return false;
    if (quest.status === 'completed') return false;
    const end = new Date(quest.planned_end);
    return end.getTime() < Date.now();
  };

  const selectedHasShift = selectedDayQuests.some(isQuestDelayed);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="md:ml-64 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
            {/* Month Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Calendar</h1>
                <p className="text-muted-foreground">{monthName}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Card */}
              <div className="lg:col-span-3">
                <Card className="border-border bg-card/50 backdrop-blur card-glow p-6">
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center font-semibold text-muted-foreground py-2 text-sm">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {calendarGrid.map((day, idx) => {
                      const isPlaceholder = day === null;
                      const isToday =
                        !isPlaceholder &&
                        isCurrentMonth &&
                        day === today.getDate();

                      const cellDate =
                        day !== null
                          ? new Date(
                              currentDate.getFullYear(),
                              currentDate.getMonth(),
                              day,
                            )
                          : null;

                      const isSelected =
                        !!cellDate &&
                        cellDate.toDateString() === selectedDate.toDateString();

                      const dateKey =
                        cellDate &&
                        cellDate.toISOString().split('T')[0];
                      const dayQuests =
                        (dateKey && questsByDate[dateKey]) || [];
                      const completedCount = dayQuests.filter(
                        q => q.status === 'completed',
                      ).length;
                      const taskCount = dayQuests.length;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (!cellDate) return;
                            setSelectedDate(cellDate);
                          }}
                          className={`min-h-32 p-2 rounded-lg border transition-all cursor-pointer ${
                            isPlaceholder
                              ? 'bg-transparent border-transparent cursor-default'
                              : isSelected
                                ? 'bg-primary/30 border-primary/50 ring-2 ring-primary/50'
                                : isToday
                                  ? 'bg-primary/20 border-primary/50'
                                  : 'bg-card/50 border-border/50 hover:bg-card/80 hover:border-primary/30'
                          }`}
                        >
                          {!isPlaceholder && (
                            <>
                              <div
                                className={`font-bold text-lg mb-2 ${
                                  isToday || isSelected
                                    ? 'text-primary'
                                    : 'text-foreground'
                                }`}
                              >
                                {day}
                              </div>

                              {/* Task Summary: show up to first 2 quests */}
                              {taskCount > 0 && (
                                <div className="space-y-1">
                                  {dayQuests.slice(0, 2).map(task => (
                                    <div
                                      key={task.id}
                                      className="text-xs p-1 rounded bg-primary/10 border border-primary/30 text-primary truncate"
                                    >
                                      {task.title}
                                    </div>
                                  ))}
                                  {taskCount > 2 && (
                                    <div className="text-xs text-muted-foreground px-1">
                                      +{taskCount - 2} more
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Progress Bar */}
                              {taskCount > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/30">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-accent transition-all"
                                        style={{
                                          width: `${
                                            (completedCount / taskCount) * 100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {completedCount}/{taskCount}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Stats */}
              <div className="bg-card/50 border border-border/50 rounded-xl p-4 card-glow">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Total Quests
                </h3>
                <p className="text-3xl font-bold">
                  {isLoading ? '—' : monthTotal}
                </p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </div>
              <div className="bg-card/50 border border-border/50 rounded-xl p-4 card-glow">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Completed
                </h3>
                <p className="text-3xl font-bold text-accent">
                  {isLoading ? '—' : monthCompleted}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoading || monthTotal === 0
                    ? '0% rate'
                    : `${monthRate}% rate`}
                </p>
              </div>
              <div className="bg-card/50 border border-border/50 rounded-xl p-4 card-glow">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Streak
                </h3>
                <p className="text-3xl font-bold text-primary">
                  {streakDays ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Days</p>
              </div>
            </div>

            {/* Day View */}
            <div>
              <h2 className="text-xl font-bold text-foreground mb-4">
                {selectedDate.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                Schedule
              </h2>

              <Card className="border-border bg-card/50 backdrop-blur card-glow p-6 space-y-4">
                {/* Alert */}
                {selectedHasShift && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                    <AlertCircle size={20} className="text-destructive flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-destructive mb-1">Schedule Shift Detected</p>
                      <p className="text-destructive/80 text-xs">Some quests are delayed. Next tasks shifted forward.</p>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {selectedDayQuests.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDayQuests
                      .slice()
                      .sort((a, b) => {
                        const ta = a.planned_start
                          ? new Date(a.planned_start).getTime()
                          : 0;
                        const tb = b.planned_start
                          ? new Date(b.planned_start).getTime()
                          : 0;
                        return ta - tb;
                      })
                      .map((item, index, arr) => (
                      <div
                        key={item.id}
                        className={`relative flex gap-4 p-4 rounded-lg border transition-all bg-secondary/5 border-border/50 hover:border-primary/50 cursor-pointer`}
                      >
                        {/* Timeline connector */}
                        {index !== arr.length - 1 && (
                          <div className="absolute left-[2.5rem] top-full h-6 w-0.5 bg-border/30" />
                        )}

                        {/* Time and Status */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${getStatusColor(item.status)}`}
                          >
                            {item.status === 'completed' && (
                              <CheckCircle size={16} className="fill-current" />
                            )}
                          </div>
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {item.planned_start
                              ? new Date(item.planned_start).toLocaleTimeString(
                                  [],
                                  { hour: '2-digit', minute: '2-digit' },
                                )
                              : '--:--'}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">{item.title}</h3>
                              {isQuestDelayed(item) && (
                                <Badge className="bg-destructive/20 text-destructive border-destructive/50 text-xs">
                                  Delayed
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock size={14} />
                              <span>
                                {item.planned_start && item.planned_end
                                  ? `${new Date(
                                      item.planned_start,
                                    ).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })} - ${new Date(
                                      item.planned_end,
                                    ).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : 'No fixed duration'}
                              </span>
                            </div>
                          </div>

                          {/* XP Reward */}
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-secondary/20 rounded-lg border border-secondary/30 flex-shrink-0">
                            <Zap size={16} className="text-secondary" />
                            <span className="font-bold text-secondary">
                              {item.xp_reward}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No schedule for this day</p>
                  </div>
                )}

                {/* Summary Stats */}
                {selectedDayQuests.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border/30 grid grid-cols-3 gap-3">
                    <div className="text-center p-2">
                      <p className="text-xs text-muted-foreground mb-1">Total Tasks</p>
                      <p className="text-lg font-bold text-foreground">
                        {selectedTotal}
                      </p>
                    </div>
                    <div className="text-center p-2">
                      <p className="text-xs text-muted-foreground mb-1">Completed</p>
                      <p className="text-lg font-bold text-accent">
                        {selectedCompleted}
                      </p>
                    </div>
                    <div className="text-center p-2">
                      <p className="text-xs text-muted-foreground mb-1">Total XP</p>
                      <p className="text-lg font-bold text-primary">
                        {selectedTotalXP}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
