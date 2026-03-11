'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle2, Clock, AlertCircle, Zap, Plus, Search, Edit2, Trash2, Play, MoreVertical } from 'lucide-react';

interface Quest {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  estimated_minutes: number | null;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';
  xp_reward: number;
  reward_points: number;
  penalties_points: number;
  max_minus_points: number;
  current_minus_points: number;
  is_fixed: boolean;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  rank_id: string | null;
  rank_name?: string;
  rank_code?: string;
  logs?: string[];
  shiftHistory?: { from: string; to: string }[];
  actualTiming?: string;
  linkedPenalty?: string;
}

const initialQuests: Quest[] = [];
const PAGE_SIZE = 30;

const getRankColor = (rank: string) => {
  const colors: Record<string, string> = {
    'S': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    'A': 'bg-red-500/20 text-red-400 border-red-500/50',
    'B': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'C': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'D': 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  };
  return colors[rank] || colors['D'];
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-accent" />;
    case 'in-progress':
      return <Zap className="w-4 h-4 text-primary" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    case 'delayed':
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    default:
      return null;
  }
};

export default function QuestsPage() {
  const router = useRouter();
  const [quests, setQuests] = useState<Quest[]>(initialQuests);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [ranks, setRanks] = useState<any[]>([]);
  const [ranksLoading, setRanksLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    color: '#3b82f6',
    description: '',
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    rank: '',
    xp: 50,
    points: 25,
    penalty: 0,
    minusPoints: 0,
    fixed: true,
    recurring: false,
    recurringPattern: 'daily',
  });

  const filteredQuests = quests.filter(q => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.category ?? '')
        .toString()
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || String(q.category) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Order: pending / in-progress / delayed (and others) first, completed at the bottom.
  const statusWeight: Record<Quest['status'], number> = {
    'pending': 0,
    'in-progress': 0,
    'delayed': 0,
    'cancelled': 1,
    'completed': 2,
  };

  const sortedQuests = [...filteredQuests].sort((a, b) => {
    const wa = statusWeight[a.status] ?? 0;
    const wb = statusWeight[b.status] ?? 0;
    if (wa !== wb) return wa - wb;
    // Within the same bucket, order by date then planned_start
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const sa = a.planned_start || '';
    const sb = b.planned_start || '';
    return sa.localeCompare(sb);
  });

  const filterByStatus = (status: string) =>
    sortedQuests.filter(q => (status === 'all' ? true : q.status === status));

  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          console.log('[v0] Fetched categories:', data);
          setCategories(data.categories || []);
          // Set first category as default if available
          if (data.categories && data.categories.length > 0 && !formData.category) {
            setFormData(prev => ({ ...prev, category: data.categories[0].id }));
          }
        }
      } catch (error) {
        console.error('[v0] Error fetching categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch ranks from database
  useEffect(() => {
    const fetchRanks = async () => {
      try {
        setRanksLoading(true);
        const response = await fetch('/api/ranks');
        if (response.ok) {
          const data = await response.json();
          console.log('[v0] Fetched ranks:', data);
          setRanks(data.ranks || []);
          // Set first rank as default if available
if (data.ranks && data.ranks.length > 0 && !formData.rank) {
          setFormData(prev => ({ ...prev, rank: data.ranks[0].id }));
        }
        }
      } catch (error) {
        console.error('[v0] Error fetching ranks:', error);
      } finally {
        setRanksLoading(false);
      }
    };

    fetchRanks();
  }, []);

  // Fetch quests from database
  useEffect(() => {
    const fetchQuests = async () => {
      try {
        const response = await fetch('/api/quests');
        if (response.ok) {
          const data = await response.json();
          console.log('[v0] Fetched quests:', data);
          setQuests(data.quests || []);
        } else {
          console.error('[v0] Failed to fetch quests:', response.statusText);
        }
      } catch (error) {
        console.error('[v0] Error fetching quests:', error);
      }
    };

    fetchQuests();
  }, []);

  const handleStatusChange = async (
    questId: string,
    newStatus: Quest['status'],
  ) => {
    const prevQuests = quests;
    const nowIso = new Date().toISOString();

    // optimistic update
    setQuests(current =>
      current.map(q =>
        q.id === questId
          ? {
              ...q,
              status: newStatus,
              actual_start:
                newStatus === 'in-progress' ? nowIso : q.actual_start,
              actual_end: newStatus === 'completed' ? nowIso : q.actual_end,
            }
          : q,
      ),
    );

    try {
      const response = await fetch('/api/quests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: questId, status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update quest');
      }
    } catch (error) {
      console.error('[v0] Error updating quest status:', error);
      setQuests(prevQuests);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to update quest status',
      );
    }
  };

  const handleDelete = async (questId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this quest?',
    );
    if (!confirmed) return;

    const prevQuests = quests;
    setQuests(current => current.filter(q => q.id !== questId));

    try {
      const response = await fetch('/api/quests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: questId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete quest');
      }
    } catch (error) {
      console.error('[v0] Error deleting quest:', error);
      setQuests(prevQuests);
      alert(
        error instanceof Error ? error.message : 'Failed to delete quest',
      );
    }
  };

  const handleQuestClick = (quest: Quest) => {
    setSelectedQuest(quest);
    setIsDetailOpen(true);
  };

  const handleCreateQuest = async () => {
    try {
      setIsSubmitting(true);
      console.log('[v0] Creating quest with data:', formData);

      if (!formData.title.trim() || !formData.date) {
        alert('Please fill in title and date');
        return;
      }

      const response = await fetch('/api/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          rank: formData.rank,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          xp: formData.xp,
          points: formData.points,
          penalty: formData.penalty,
          minusPoints: formData.minusPoints,
          fixed: formData.fixed,
          recurring: formData.recurring,
          recurringPattern: formData.recurringPattern,
        }),
      });

      console.log('[v0] Response status:', response.status);
      const data = await response.json();
      console.log('[v0] Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create quest');
      }

      // Reset form
      setIsFormOpen(false);
      setFormData({
        title: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        rank: 'B',
        xp: 50,
        points: 25,
        penalty: 0,
        minusPoints: 0,
        fixed: true,
        recurring: false,
        recurringPattern: 'daily',
      });

      alert('Quest created successfully!');

      // Refresh quests list
      const refreshResponse = await fetch('/api/quests');
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setQuests(refreshData.quests || []);
      }
    } catch (error) {
      console.error('[v0] Error creating quest:', error);
      alert(error instanceof Error ? error.message : 'Failed to create quest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditQuest = (quest: Quest) => {
    setFormData({
      title: quest.title,
      description: quest.description || '',
      category: quest.category || '',
      date: quest.date,
      startTime: quest.planned_start ? new Date(quest.planned_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '09:00',
      endTime: quest.planned_end ? new Date(quest.planned_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '10:00',
      penalty: quest.penalties_points,
      rank: quest.rank_id || '',
      xp: quest.xp_reward,
      points: quest.reward_points,
      minusPoints: quest.current_minus_points || 0,
      fixed: quest.is_fixed,
      recurring: quest.is_recurring,
      recurringPattern: quest.recurrence_rule?.includes('DAILY') ? 'daily' : 
                        quest.recurrence_rule?.includes('WEEKLY') ? 'weekly' :
                        quest.recurrence_rule?.includes('MONTHLY') ? 'monthly' :
                        quest.recurrence_rule?.includes('YEARLY') ? 'yearly' : 'daily',
    });
    setEditingQuestId(quest.id);
    setIsEditOpen(true);
    setIsDetailOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editingQuestId) return;

    setIsSavingEdit(true);

    const plannedStart =
      formData.date && formData.startTime
        ? new Date(
            `${formData.date}T${formData.startTime}:00`,
          ).toISOString()
        : null;
    const plannedEnd =
      formData.date && formData.endTime
        ? new Date(`${formData.date}T${formData.endTime}:00`).toISOString()
        : null;

    const prevQuests = quests;

    // optimistic local update
    setQuests(current =>
      current.map(q =>
        q.id === editingQuestId
          ? {
              ...q,
              title: formData.title,
              description: formData.description || null,
              category: formData.category || null,
              date: formData.date,
              planned_start: plannedStart,
              planned_end: plannedEnd,
              rank_id: formData.rank || null,
              xp_reward: formData.xp,
              reward_points: formData.points,
              penalties_points: formData.penalty,
              max_minus_points: formData.minusPoints ?? 0,
              is_fixed: formData.fixed,
              is_recurring: formData.recurring,
              recurrence_rule: formData.recurring
                ? `FREQ=${(formData.recurringPattern || 'daily').toUpperCase()}`
                : null,
            }
          : q,
      ),
    );

    try {
      const response = await fetch('/api/quests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingQuestId,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          xp: formData.xp,
          points: formData.points,
          penalty: formData.penalty,
          minusPoints: formData.minusPoints,
          rank: formData.rank,
          fixed: formData.fixed,
          recurring: formData.recurring,
          recurringPattern: formData.recurringPattern,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save quest changes');
      }

      setIsEditOpen(false);
      setEditingQuestId(null);
      setFormData({
        title: '',
        description: '',
        category: 'Productivity',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        rank: 'B',
        xp: 50,
        points: 25,
        penalty: 5,
        minusPoints: 0,
        fixed: true,
        recurring: false,
        recurringPattern: 'daily',
      });

      // Refresh data from the server so everything is in sync
      router.refresh();
    } catch (error) {
      console.error('[v0] Error saving quest edits:', error);
      setQuests(prevQuests);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to save quest changes',
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="md:ml-64 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Quests</h1>
                <p className="text-muted-foreground">Manage your daily tasks and challenges</p>
              </div>
              <div className="flex gap-2">
                <Button className="bg-primary/30 hover:bg-primary/40 gap-2 text-primary" onClick={() => setIsCategoryFormOpen(true)}>
                  <Plus className="w-4 h-4" />
                  New Category
                </Button>
                <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={() => setIsFormOpen(true)}>
                  <Plus className="w-4 h-4" />
                  New Quest
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or category..."
                  className="pl-10 bg-card/50 border-border"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-card/50 border-border">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem
                      key={cat.id}
                      value={String(cat.id)}
                      className="cursor-pointer"
                    >
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Tabs */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-5 bg-card/50 border border-border">
                <TabsTrigger value="all">All ({filteredQuests.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({filterByStatus('pending').length})</TabsTrigger>
                <TabsTrigger value="in-progress">Active ({filterByStatus('in-progress').length})</TabsTrigger>
                <TabsTrigger value="completed">Done ({filterByStatus('completed').length})</TabsTrigger>
                <TabsTrigger value="delayed">Delayed ({filterByStatus('delayed').length})</TabsTrigger>
              </TabsList>

              {['all', 'pending', 'in-progress', 'completed', 'delayed'].map(tab => {
                const allForTab = filterByStatus(tab);
                const totalForTab = allForTab.length;
                const totalPages = Math.max(1, Math.ceil(totalForTab / PAGE_SIZE));
                const effectivePage = Math.min(currentPage, totalPages);
                const startIndex = (effectivePage - 1) * PAGE_SIZE;
                const pageItems = allForTab.slice(startIndex, startIndex + PAGE_SIZE);

                return (
                  <TabsContent key={tab} value={tab} className="space-y-4 mt-6">
                    {totalForTab === 0 ? (
                      <Card className="border-border bg-card/50 p-8 text-center">
                        <p className="text-muted-foreground">No quests found</p>
                      </Card>
                    ) : (
                      <>
                        {pageItems.map(quest => (
                          <Card
                            key={quest.id}
                            onClick={() => handleQuestClick(quest)}
                            className={`border-border bg-card/50 backdrop-blur card-glow p-6 hover:border-primary/50 cursor-pointer transition-all ${quest.status === 'completed' ? 'opacity-75' : ''
                              }`}
                          >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Main Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <h3 className="text-lg font-semibold">{quest.title}</h3>
                              {(() => {
                                const questCategory = categories.find(
                                  (cat) => String(cat.id) === String(quest.category),
                                );
                                if (!questCategory) return null;
                                return (
                                  <Badge
                                    variant="outline"
                                    className="border-border text-xs"
                                    style={{
                                      backgroundColor: `${questCategory.color}22`,
                                      color: questCategory.color,
                                      borderColor: `${questCategory.color}88`,
                                    }}
                                  >
                                    {questCategory.name}
                                  </Badge>
                                );
                              })()}
                              {quest.rank_code && (
                                <Badge className="bg-primary/20 text-primary border-primary/50 text-xs">{quest.rank_code}-Rank</Badge>
                              )}
                              {quest.is_recurring && (
                                <Badge className="bg-secondary/20 text-secondary border-secondary/50 text-xs">Recurring</Badge>
                              )}
                              {!quest.is_fixed && (
                                <Badge className="bg-accent/20 text-accent border-accent/50 text-xs">Flexible</Badge>
                              )}
                            </div>
                            {quest.description && (
                              <p className="text-sm text-muted-foreground mb-3">{quest.description}</p>
                            )}

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground block text-xs mb-1">Date</span>
                                <p className="font-semibold">{new Date(quest.date).toLocaleDateString()}</p>
                              </div>
                              {quest.planned_start && quest.planned_end && (
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Time</span>
                                  <p className="font-semibold">
                                    {new Date(quest.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                    {new Date(quest.planned_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground block text-xs mb-1">XP</span>
                                <p className="font-semibold text-primary">+{quest.xp_reward}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-xs mb-1">Points</span>
                                <p className="font-semibold text-secondary">
                                  +{quest.reward_points}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-xs mb-1">
                                  Penalty Points
                                </span>
                                <p className="font-semibold text-red-500">
                                  -{quest.penalties_points}
                                </p>
                              </div>
                            </div>

                            {/* Status and Actions */}
                            <div className="flex items-center gap-3 mt-4 lg:flex-col lg:items-end">
                              {(() => {
                                const now = new Date();
                                const isDelayed =
                                  quest.planned_end &&
                                  quest.status !== 'completed' &&
                                  new Date(quest.planned_end) < now;
                                const baseBadge =
                                  quest.status === 'completed'
                                    ? 'bg-accent/20 text-accent'
                                    : quest.status === 'in-progress'
                                      ? 'bg-primary/20 text-primary'
                                      : 'bg-muted/20 text-muted-foreground';
                                return (
                                  <div className="flex items-center gap-2">
                                    {isDelayed ? (
                                      <AlertCircle className="w-4 h-4 text-destructive" />
                                    ) : (
                                      getStatusIcon(quest.status)
                                    )}
                                    <Badge
                                      className={`text-xs capitalize ${
                                        isDelayed
                                          ? 'bg-destructive/20 text-destructive'
                                          : baseBadge
                                      }`}
                                    >
                                      {isDelayed
                                        ? 'delayed'
                                        : quest.status.replace('-', ' ')}
                                    </Badge>
                                  </div>
                                );
                              })()}

                              {/* Quick Actions */}
                              <div className="flex gap-2">
                                {quest.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(quest.id, 'in-progress');
                                    }}
                                  >
                                    <Play className="w-3 h-3" />
                                    Start
                                  </Button>
                                )}
                                {quest.status === 'in-progress' && (
                                  <Button
                                    size="sm"
                                    className="bg-accent hover:bg-accent/90"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(quest.id, 'completed');
                                    }}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Done
                                  </Button>
                                )}
                                {/* More Actions */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-card/95 border-border" onClick={(e) => e.stopPropagation()}>
                                    <DialogHeader>
                                      <DialogTitle>Actions</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                      <Button variant="outline" className="w-full justify-start" onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditQuest(quest);
                                      }}>
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Edit Quest
                                      </Button>
                                      <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(quest.id);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Quest
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                          </div>
                        </div>
                          </Card>
                        ))}

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                            <button
                              type="button"
                              disabled={effectivePage === 1}
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className={`px-3 py-1 rounded border ${
                                effectivePage === 1
                                  ? 'opacity-50 cursor-not-allowed border-border'
                                  : 'border-border hover:border-primary'
                              }`}
                            >
                              Previous
                            </button>
                            <span>
                              Page {effectivePage} of {totalPages}
                            </span>
                            <button
                              type="button"
                              disabled={effectivePage === totalPages}
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className={`px-3 py-1 rounded border ${
                                effectivePage === totalPages
                                  ? 'opacity-50 cursor-not-allowed border-border'
                                  : 'border-border hover:border-primary'
                              }`}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </main>
      </div>

      {/* Quest Creation Form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-card/95 border-border/50 backdrop-blur-md flex flex-col p-0 [&>button]:z-50">
          <DialogHeader className="sticky top-0 bg-gradient-to-b from-card/95 to-card/80 z-20 px-6 pt-6 pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Create New Quest</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Title & Description Section */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-primary">Quest Title *</label>
                  <Input
                    placeholder="Enter quest title..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-2 bg-card/50 border-primary/30 hover:border-primary/50 focus:border-primary/70 transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-secondary">Description</label>
                  <Input
                    placeholder="Add quest details..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-2 bg-card/50 border-secondary/30 hover:border-secondary/50 focus:border-secondary/70 transition-all"
                  />
                </div>
              </div>

              {/* Category & Rank Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 min-w-0">
                  <label className="text-sm font-semibold text-secondary">Category</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger className="bg-card/50 border-secondary/30 w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      {categoriesLoading ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Loading categories...
                        </div>
                      ) : categories.length > 0 ? (
                        categories.map(cat => (
                          <SelectItem
                            key={cat.id}
                            value={String(cat.id)}
                            className="cursor-pointer"
                          >
                            {cat.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No categories found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-0">
                  <label className="text-sm font-semibold text-secondary">Difficulty Rank</label>
                  <Select value={formData.rank} onValueChange={(value) => setFormData({ ...formData, rank: value })}>
                    <SelectTrigger className="bg-card/50 border-secondary/30">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranksLoading ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading ranks...</div>
                      ) : ranks.length > 0 ? (
                        ranks.map(rank => (
                          <SelectItem key={rank.id} value={rank.id} className="cursor-pointer">
                            {rank.code} - {rank.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No ranks found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-primary">Quest Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-card/50 border-primary/30 hover:border-primary/50 focus:border-primary/70 transition-all"
                />
              </div>

              {/* Quest Duration Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-secondary">Quest Duration</label>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Start Time</p>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="bg-card/50 border-secondary/30 hover:border-secondary/50 focus:border-secondary/70 transition-all"
                    />
                  </div>
                  <div className="flex justify-center pb-0.5">
                    <div className="text-2xl text-muted-foreground/30">→</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">End Time</p>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="bg-card/50 border-secondary/30 hover:border-secondary/50 focus:border-secondary/70 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Rewards & Quest Type Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-accent">Rewards</label>
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/30 rounded-lg">
                    {/* XP Reward */}
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">XP Reward</p>
                      <div className="flex items-center justify-between bg-card/70 border border-accent/40 rounded-lg p-1 h-10">
                        <button
                          onClick={() => setFormData({ ...formData, xp: Math.max(0, formData.xp - 10) })}
                          className="w-8 h-8 text-accent hover:bg-accent/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          value={formData.xp}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, xp: Math.max(0, val) });
                          }}
                          className="w-12 bg-transparent text-center text-accent font-bold text-base focus:outline-none"
                        />
                        <button
                          onClick={() => setFormData({ ...formData, xp: formData.xp + 10 })}
                          className="w-8 h-8 text-accent hover:bg-accent/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Points</p>
                      <div className="flex items-center justify-between bg-card/70 border border-secondary/40 rounded-lg p-1 h-10">
                        <button
                          onClick={() => setFormData({ ...formData, points: Math.max(0, formData.points - 5) })}
                          className="w-8 h-8 text-secondary hover:bg-secondary/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          value={formData.points}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, points: Math.max(0, val) });
                          }}
                          className="w-12 bg-transparent text-center text-secondary font-bold text-base focus:outline-none"
                        />
                        <button
                          onClick={() => setFormData({ ...formData, points: formData.points + 5 })}
                          className="w-8 h-8 text-secondary hover:bg-secondary/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Penalty */}
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Penalty</p>
                      <div className="flex items-center justify-between bg-card/70 border border-destructive/40 rounded-lg p-1 h-10">
                        <button
                          onClick={() => setFormData({ ...formData, penalty: Math.max(0, formData.penalty - 5) })}
                          className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          value={formData.penalty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, penalty: Math.max(0, val) });
                          }}
                          className="w-12 bg-transparent text-center text-destructive font-bold text-base focus:outline-none"
                        />
                        <button
                          onClick={() => setFormData({ ...formData, penalty: formData.penalty + 5 })}
                          className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Max Minus Points */}
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Max Minus Points</p>
                      <div className="flex items-center justify-between bg-card/70 border border-destructive/40 rounded-lg p-1 h-10">
                        <button
                          onClick={() => setFormData({ ...formData, minusPoints: Math.max(0, formData.minusPoints - 5) })}
                          className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          value={formData.minusPoints}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, minusPoints: Math.max(0, val) });
                          }}
                          className="w-12 bg-transparent text-center text-destructive font-bold text-base focus:outline-none"
                        />
                        <button
                          onClick={() => setFormData({ ...formData, minusPoints: formData.minusPoints + 5 })}
                          className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quest Type Section */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-secondary">Quest Type</label>
                  <div className="flex gap-3">
                    <label className="flex-1 flex items-center gap-3 cursor-pointer group p-3 rounded-lg bg-card/50 border border-primary/20 hover:border-primary/50 hover:bg-card/70 transition-all">
                      <div className="w-5 h-5 rounded border-2 border-primary/50 group-hover:border-primary/80 flex items-center justify-center transition-all">
                        {formData.fixed && <div className="w-3 h-3 bg-primary rounded-sm" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.fixed}
                        onChange={(e) => setFormData({ ...formData, fixed: e.target.checked })}
                        className="hidden"
                      />
                      <span className="text-sm font-medium text-foreground">Fixed Schedule</span>
                    </label>
                    <label className="flex-1 flex items-center gap-3 cursor-pointer group p-3 rounded-lg bg-card/50 border border-secondary/20 hover:border-secondary/50 hover:bg-card/70 transition-all">
                      <div className="w-5 h-5 rounded border-2 border-secondary/50 group-hover:border-secondary/80 flex items-center justify-center transition-all">
                        {formData.recurring && <div className="w-3 h-3 bg-secondary rounded-sm" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.recurring}
                        onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                        className="hidden"
                      />
                      <span className="text-sm font-medium text-foreground">Repeating Quest</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Recurring Pattern - Show only if recurring is enabled */}
              {formData.recurring && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-secondary">Repeat Every</label>
                  <Select value={formData.recurringPattern || 'daily'} onValueChange={(value) => setFormData({ ...formData, recurringPattern: value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}>
                    <SelectTrigger className="bg-card/50 border-secondary/30 w-full">
                      <SelectValue placeholder="Select pattern" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="daily" className="cursor-pointer">Daily</SelectItem>
                      <SelectItem value="weekly" className="cursor-pointer">Weekly</SelectItem>
                      <SelectItem value="monthly" className="cursor-pointer">Monthly</SelectItem>
                      <SelectItem value="yearly" className="cursor-pointer">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Spacing for bottom */}
              <div className="h-2" />
            </div>
          </div>

          {/* Footer Actions - Fixed */}
          <div className="bg-gradient-to-t from-card/95 via-card/90 to-card/50 px-6 py-4 border-t border-border/20 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="border-border/50 hover:bg-card/80">
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-primary via-secondary to-primary hover:shadow-lg hover:shadow-primary/20 text-primary-foreground font-semibold transition-all"
              onClick={handleCreateQuest}
              disabled={!formData.title.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Quest'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Category Form */}
      <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
        <DialogContent className="max-w-2xl bg-card/95 border-border/50 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Create New Category</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Add a new quest category to organize your tasks</p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category Name*</label>
              <Input
                placeholder="e.g., Productivity, Health, Work..."
                className="bg-card/50 border-border"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
              />
            </div>

            {/* Category Color */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category Color</label>
              <div className="flex gap-2 flex-wrap">
                {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444'].map(color => (
                  <button
                    key={color}
                    onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                    className={`w-10 h-10 rounded-lg transition-all ${categoryFormData.color === color ? 'ring-2 ring-offset-2 ring-offset-background ring-white scale-110' : ''
                      }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Category Description */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description (Optional)</label>
              <textarea
                placeholder="Add a description for this category..."
                className="w-full min-h-20 bg-card/50 border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsCategoryFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={async () => {
                try {
                  setIsCategorySubmitting(true);
                  console.log('[v0] Category form data:', categoryFormData);

                  if (!categoryFormData.name.trim()) {
                    alert('Please enter a category name');
                    return;
                  }

                  const response = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(categoryFormData),
                  });

                  console.log('[v0] Response status:', response.status);
                  const data = await response.json();
                  console.log('[v0] Response data:', data);

                  if (!response.ok) {
                    throw new Error(data.error || 'Failed to create category');
                  }

                  console.log('Category created:', data);

                  // Refresh categories list
                  const refreshResponse = await fetch('/api/categories');
                  if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json();
                    setCategories(refreshData.categories || []);
                  }

                  // Close form and reset
                  setIsCategoryFormOpen(false);
                  setCategoryFormData({ name: '', color: '#3b82f6', description: '' });
                  alert('Category created successfully!');
                } catch (error) {
                  console.error('[v0] Error creating category:', error);
                  alert(error instanceof Error ? error.message : 'Failed to create category');
                } finally {
                  setIsCategorySubmitting(false);
                }
              }}
              disabled={!categoryFormData.name.trim() || isCategorySubmitting}
            >
              {isCategorySubmitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quest Edit Form */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-card/95 border-border/50 backdrop-blur-md flex flex-col p-0 [&>button]:z-50">
          <DialogHeader className="sticky top-0 bg-gradient-to-b from-card/95 to-card/80 z-20 px-6 pt-6 pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Edit Quest</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Update your quest details</p>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-6">
            <div className="space-y-5">
              {/* Title Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-primary">Quest Title *</label>
                <Input
                  placeholder="Enter an epic quest title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-card/50 border-primary/30 hover:border-primary/50 focus:border-primary/70 text-foreground placeholder-muted-foreground/50 transition-all"
                />
              </div>

              {/* Description Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-primary">Description</label>
                <textarea
                  placeholder="Describe what this quest is about..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-card/50 border border-primary/30 hover:border-primary/50 focus:border-primary/70 text-foreground placeholder-muted-foreground/50 focus:outline-none transition-all"
                  rows={3}
                />
              </div>

              {/* Category & Rank Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 min-w-0">
                  <label className="text-sm font-semibold text-secondary">Category</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger className="bg-card/50 border-secondary/30 w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      {categoriesLoading ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Loading categories...
                        </div>
                      ) : categories.length > 0 ? (
                        categories.map(cat => (
                          <SelectItem
                            key={cat.id}
                            value={String(cat.id)}
                            className="cursor-pointer"
                          >
                            {cat.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No categories found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-0">
                  <label className="text-sm font-semibold text-secondary">Difficulty Rank</label>
                  <Select value={formData.rank} onValueChange={(value) => setFormData({ ...formData, rank: value })}>
                    <SelectTrigger className="bg-card/50 border-secondary/30">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranksLoading ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading ranks...</div>
                      ) : ranks.length > 0 ? (
                        ranks.map(rank => (
                          <SelectItem key={rank.id} value={rank.id} className="cursor-pointer">
                            {rank.code} - {rank.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No ranks found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-primary">Quest Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-card/50 border-primary/30 hover:border-primary/50 focus:border-primary/70 transition-all"
                />
              </div>

              {/* Time Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-secondary">Quest Duration</label>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Start Time</p>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="bg-card/50 border-secondary/30 hover:border-secondary/50 focus:border-secondary/70 transition-all"
                    />
                  </div>
                  <div className="flex justify-center pb-0.5">
                    <div className="text-2xl text-muted-foreground/30">→</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">End Time</p>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="bg-card/50 border-secondary/30 hover:border-secondary/50 focus:border-secondary/70 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Rewards Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-accent">Rewards</label>
                <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/30 rounded-lg">
                  {/* XP Reward */}
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">XP Reward</p>
                    <div className="flex items-center justify-between bg-card/70 border border-accent/40 rounded-lg p-1 h-10">
                      <button
                        onClick={() => setFormData({ ...formData, xp: Math.max(0, formData.xp - 10) })}
                        className="w-8 h-8 text-accent hover:bg-accent/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        value={formData.xp}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, xp: Math.max(0, val) });
                        }}
                        className="w-12 bg-transparent text-center text-accent font-bold text-base focus:outline-none"
                      />
                      <button
                        onClick={() => setFormData({ ...formData, xp: formData.xp + 10 })}
                        className="w-8 h-8 text-accent hover:bg-accent/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Points</p>
                    <div className="flex items-center justify-between bg-card/70 border border-secondary/40 rounded-lg p-1 h-10">
                      <button
                        onClick={() => setFormData({ ...formData, points: Math.max(0, formData.points - 5) })}
                        className="w-8 h-8 text-secondary hover:bg-secondary/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        value={formData.points}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, points: Math.max(0, val) });
                        }}
                        className="w-12 bg-transparent text-center text-secondary font-bold text-base focus:outline-none"
                      />
                      <button
                        onClick={() => setFormData({ ...formData, points: formData.points + 5 })}
                        className="w-8 h-8 text-secondary hover:bg-secondary/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Penalty */}
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Penalty</p>
                    <div className="flex items-center justify-between bg-card/70 border border-destructive/40 rounded-lg p-1 h-10">
                      <button
                        onClick={() => setFormData({ ...formData, penalty: Math.max(0, formData.penalty - 5) })}
                        className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        value={formData.penalty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, penalty: Math.max(0, val) });
                        }}
                        className="w-12 bg-transparent text-center text-destructive font-bold text-base focus:outline-none"
                      />
                      <button
                        onClick={() => setFormData({ ...formData, penalty: formData.penalty + 5 })}
                        className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Max Minus Points */}
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Max Minus Points</p>
                    <div className="flex items-center justify-between bg-card/70 border border-destructive/40 rounded-lg p-1 h-10">
                      <button
                        onClick={() => setFormData({ ...formData, minusPoints: Math.max(0, formData.minusPoints - 5) })}
                        className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        value={formData.minusPoints}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, minusPoints: Math.max(0, val) });
                        }}
                        className="w-12 bg-transparent text-center text-destructive font-bold text-base focus:outline-none"
                      />
                      <button
                        onClick={() => setFormData({ ...formData, minusPoints: formData.minusPoints + 5 })}
                        className="w-8 h-8 text-destructive hover:bg-destructive/30 transition-colors font-bold text-lg active:scale-95 rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Options Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-secondary">Quest Type</label>
                <div className="flex gap-3">
                  <label className="flex-1 flex items-center gap-3 cursor-pointer group p-3 rounded-lg bg-card/50 border border-primary/20 hover:border-primary/50 hover:bg-card/70 transition-all">
                    <div className="w-5 h-5 rounded border-2 border-primary/50 group-hover:border-primary/80 flex items-center justify-center transition-all">
                      {formData.fixed && <div className="w-3 h-3 bg-primary rounded-sm" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.fixed}
                      onChange={(e) => setFormData({ ...formData, fixed: e.target.checked })}
                      className="hidden"
                    />
                    <span className="text-sm font-medium text-foreground">Fixed Schedule</span>
                  </label>
                  <label className="flex-1 flex items-center gap-3 cursor-pointer group p-3 rounded-lg bg-card/50 border border-secondary/20 hover:border-secondary/50 hover:bg-card/70 transition-all">
                    <div className="w-5 h-5 rounded border-2 border-secondary/50 group-hover:border-secondary/80 flex items-center justify-center transition-all">
                      {formData.recurring && <div className="w-3 h-3 bg-secondary rounded-sm" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                      className="hidden"
                    />
                    <span className="text-sm font-medium text-foreground">Repeating Quest</span>
                  </label>
                </div>
              </div>

              {/* Recurring Pattern - Show only if recurring is enabled */}
              {formData.recurring && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-secondary">Repeat Every</label>
                  <Select value={formData.recurringPattern || 'daily'} onValueChange={(value) => setFormData({ ...formData, recurringPattern: value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}>
                    <SelectTrigger className="bg-card/50 border-secondary/30 w-full">
                      <SelectValue placeholder="Select pattern" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="daily" className="cursor-pointer">Daily</SelectItem>
                      <SelectItem value="weekly" className="cursor-pointer">Weekly</SelectItem>
                      <SelectItem value="monthly" className="cursor-pointer">Monthly</SelectItem>
                      <SelectItem value="yearly" className="cursor-pointer">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Spacing for bottom */}
              <div className="h-2" />
            </div>
          </div>

          {/* Footer Actions - Fixed */}
          <div className="bg-gradient-to-t from-card/95 via-card/90 to-card/50 px-6 py-4 border-t border-border/20 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-border/50 hover:bg-card/80">
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-primary via-secondary to-primary hover:shadow-lg hover:shadow-primary/20 text-primary-foreground font-semibold transition-all"
              onClick={handleSaveEdit}
              disabled={!formData.title.trim()}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quest Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card/95 border-border">
          {selectedQuest && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedQuest.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="font-semibold">
                      {(() => {
                        const questCategory = categories.find(
                          (cat) => String(cat.id) === String(selectedQuest.category),
                        );
                        return questCategory ? questCategory.name : '—';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Rank</p>
                    <Badge className="bg-primary/20 text-primary border-primary/50">{selectedQuest.rank_code ? `${selectedQuest.rank_code}-Rank` : '—'}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="font-semibold">{selectedQuest.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                    <p className="font-semibold">
                      {selectedQuest.planned_start && selectedQuest.planned_end
                        ? `${new Date(selectedQuest.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(selectedQuest.planned_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Rewards */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">XP Reward</p>
                    <p className="text-xl font-bold text-primary">+{selectedQuest.xp_reward}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Points</p>
                    <p className="text-xl font-bold text-secondary">+{selectedQuest.reward_points}</p>
                  </div>
                  {(selectedQuest.current_minus_points ?? 0) > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Minus Points</p>
                      <p className="text-xl font-bold text-destructive">-{selectedQuest.current_minus_points}</p>
                    </div>
                  )}
                </div>

                {/* Type Indicators */}
                <div className="flex gap-2 flex-wrap">
                  <Badge className={selectedQuest.is_fixed ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}>
                    {selectedQuest.is_fixed ? 'Fixed' : 'Flexible'} Schedule
                  </Badge>
                  <Badge className={selectedQuest.is_recurring ? 'bg-secondary/20 text-secondary' : 'bg-muted/20 text-muted-foreground'}>
                    {selectedQuest.is_recurring ? `Recurring (${selectedQuest.recurrence_rule?.replace('FREQ=', '')?.toLowerCase() || 'daily'})` : 'One-time'}
                  </Badge>
                </div>

                {/* Logs */}
                {selectedQuest.logs && selectedQuest.logs.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Activity Logs</h3>
                    <div className="space-y-2 p-3 bg-card/50 rounded-lg border border-border/30">
                      {selectedQuest.logs.map((log, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground">• {log}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shift History */}
                {selectedQuest.shiftHistory && selectedQuest.shiftHistory.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Shift History</h3>
                    <div className="space-y-2 p-3 bg-card/50 rounded-lg border border-border/30">
                      {selectedQuest.shiftHistory.map((shift, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground">
                          • {shift.from} → {shift.to}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actual Timing */}
                {(selectedQuest.actual_start && selectedQuest.actual_end) ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual Timing</p>
                    <p className="font-semibold text-accent">
                      {new Date(selectedQuest.actual_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedQuest.actual_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : selectedQuest.actualTiming ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual Timing</p>
                    <p className="font-semibold text-accent">{selectedQuest.actualTiming}</p>
                  </div>
                ) : null}

                {/* Linked Penalty */}
                {selectedQuest.linkedPenalty && (
                  <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                    <p className="text-xs text-destructive font-semibold mb-1">Linked Penalty</p>
                    <p className="text-sm text-destructive/80">{selectedQuest.linkedPenalty}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
