'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Bell, Lock, User, Palette, Database, Settings, Zap, Trophy, Edit2, Trash2, GripVertical, Plus, Download, Clock, Moon, Upload, X, Sun } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useUser } from '@/components/user-context';

interface UserData {
  username: string;
  fullName: string;
  email: string;
  avatar: string;
}

interface UserSettings {
  id: string;
  user_id: string;
  timezone: string;
  day_start_time: string;
  day_end_time: string;
  theme: string;
  notifications_enabled: boolean;
  allow_auto_shift: boolean;
  allow_fixed_quests_shift: boolean;
}

interface Rank {
  id: string;
  name: string;
  code: string;
  color: string;
  display_order: number;
}

interface ProgressionRule {
  id: string;
  from_rank_id: string;
  to_rank_id: string;
  required_level: number;
}

export function SettingsClient() {
  const { theme, setTheme } = useTheme();
  const { user: contextUser, loading: userLoading } = useUser();
  const [user, setUser] = useState<UserData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [timezone, setTimezone] = useState('UTC');
  const [currentTime, setCurrentTime] = useState('');
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [ranksLoading, setRanksLoading] = useState(true);
  const [newRank, setNewRank] = useState({ name: '', color: '#8b5cf6' });
  const [progressionRules, setProgressionRules] = useState<ProgressionRule[]>([]);
  const [newProgression, setNewProgression] = useState({ fromRankId: '', toRankId: '', requiredLevel: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editFormData, setEditFormData] = useState({
    username: '',
    fullName: '',
    avatar: '',
  });

  // Sync context user data to local state on load
  useEffect(() => {
    if (contextUser && !userLoading) {
      setUser({
        username: contextUser.username,
        fullName: contextUser.fullName,
        email: contextUser.email,
        avatar: contextUser.avatar || '',
      });
      setEditFormData({
        username: contextUser.username,
        fullName: contextUser.fullName,
        avatar: contextUser.avatar || '',
      });
    }
  }, [contextUser, userLoading]);

  // Detect timezone and fetch user settings
  useEffect(() => {
    const detectTimezone = () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz);
    };

    const fetchUserSettings = async () => {
      try {
        const response = await fetch('/api/user-settings');
        if (response.ok) {
          const data = await response.json();
          setUserSettings(data);
        }
      } catch (error) {
        console.error('Error fetching user settings:', error);
      } finally {
        setSettingsLoading(false);
      }
    };

    const fetchRanks = async () => {
      try {
        const response = await fetch('/api/ranks');
        if (response.ok) {
          const data = await response.json();
          setRanks(data.ranks);
          setProgressionRules(data.progressionRules);
        }
      } catch (error) {
        console.error('Error fetching ranks:', error);
      } finally {
        setRanksLoading(false);
      }
    };

    detectTimezone();
    fetchUserSettings();
    fetchRanks();

    // Update current time every second
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [timezone]);

  // Apply theme when user settings load
  useEffect(() => {
    if (userSettings && userSettings.theme) {
      setTheme(userSettings.theme);
    }
  }, [userSettings?.theme, setTheme]);

  // Remove old useEffect that was fetching profile again - it's now done in useEffect above

  const handleSaveProfile = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editFormData.username,
          fullName: editFormData.fullName,
          avatar_url: editFormData.avatar,
        }),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      setUser({
        ...user,
        username: editFormData.username,
        fullName: editFormData.fullName,
        avatar: editFormData.avatar,
      });
      setIsEditingProfile(false);
      alert('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const { url } = await response.json();
      setEditFormData({ ...editFormData, avatar: url });
      setUser({ ...user, avatar: url });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!userSettings) return;

    try {
      setIsSavingSettings(true);
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: userSettings.theme,
          day_start_time: userSettings.day_start_time,
          day_end_time: userSettings.day_end_time,
          notifications_enabled: userSettings.notifications_enabled,
          allow_auto_shift: userSettings.allow_auto_shift,
          allow_fixed_quests_shift: userSettings.allow_fixed_quests_shift,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddRank = async () => {
    if (!newRank.name.trim()) {
      alert('Please enter a rank name');
      return;
    }

    try {
      const response = await fetch('/api/ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create-rank',
          name: newRank.name,
          code: newRank.name.toUpperCase().replace(/\s+/g, '-'),
          color: newRank.color,
          display_order: ranks.length + 1,
        }),
      });

      if (!response.ok) throw new Error('Failed to create rank');
      const createdRank = await response.json();
      setRanks([...ranks, createdRank]);
      setNewRank({ name: '', color: '#8b5cf6' });
      alert('Rank created successfully');
    } catch (error) {
      console.error('Error creating rank:', error);
      alert('Failed to create rank');
    }
  };

  const handleDeleteRank = async (rankId: string) => {
    if (!confirm('Are you sure you want to delete this rank?')) return;

    try {
      const response = await fetch('/api/ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'delete-rank',
          id: rankId,
        }),
      });

      if (!response.ok) throw new Error('Failed to delete rank');
      setRanks(ranks.filter(r => r.id !== rankId));
      alert('Rank deleted successfully');
    } catch (error) {
      console.error('Error deleting rank:', error);
      alert('Failed to delete rank');
    }
  };

  const handleAddProgression = async () => {
    if (!newProgression.fromRankId || !newProgression.toRankId) {
      alert('Please select both ranks');
      return;
    }

    try {
      const response = await fetch('/api/ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create-progression',
          from_rank_id: newProgression.fromRankId,
          to_rank_id: newProgression.toRankId,
          required_level: newProgression.requiredLevel,
        }),
      });

      if (!response.ok) throw new Error('Failed to create progression rule');
      const createdRule = await response.json();
      setProgressionRules([...progressionRules, createdRule]);
      setNewProgression({ fromRankId: '', toRankId: '', requiredLevel: 1 });
      alert('Progression rule created successfully');
    } catch (error) {
      console.error('Error creating progression rule:', error);
      alert('Failed to create progression rule');
    }
  };

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-6 gap-2 bg-transparent border-b border-border/50 mb-8 h-auto p-0">
        <TabsTrigger value="profile" className="gap-2 flex items-center justify-center pb-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          <User size={16} />
          <span className="hidden sm:inline">Profile</span>
        </TabsTrigger>
        <TabsTrigger value="app" className="gap-2 flex items-center justify-center pb-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          <Palette size={16} />
          <span className="hidden sm:inline">App</span>
        </TabsTrigger>
        <TabsTrigger value="system" className="gap-2 flex items-center justify-center pb-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          <Zap size={16} />
          <span className="hidden sm:inline">System</span>
        </TabsTrigger>
        <TabsTrigger value="ranks" className="gap-2 flex items-center justify-center pb-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          <Trophy size={16} />
          <span className="hidden sm:inline">Ranks</span>
        </TabsTrigger>
        <TabsTrigger value="progression" className="gap-2 flex items-center justify-center pb-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          <Bell size={16} />
          <span className="hidden sm:inline">Progress</span>
        </TabsTrigger>
      </TabsList>

      {/* Profile Settings */}
      <TabsContent value="profile" className="space-y-6 mt-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User size={20} className="text-primary" />
                  Profile Information
                </h3>
              </div>

              {isEditingProfile ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold">Username</Label>
                    <Input
                      value={editFormData.username}
                      onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                      className="mt-2 bg-card/50 border-border/30"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Full Name</Label>
                    <Input
                      value={editFormData.fullName}
                      onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                      className="mt-2 bg-card/50 border-border/30"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Avatar</Label>
                    <div className="mt-2 space-y-3">
                      {editFormData.avatar && (
                        <div className="relative w-24 h-24 rounded-lg border border-border/30 overflow-hidden bg-card/50">
                          <img
                            src={editFormData.avatar}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="gap-2 w-full"
                        >
                          <Upload size={16} />
                          {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload a new avatar image. When you have a domain configured, images will be served from there.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsEditingProfile(false)} disabled={isLoading}>
                      Cancel
                    </Button>
                    <Button className="bg-primary/20 hover:bg-primary/30 text-primary" onClick={handleSaveProfile} disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {user ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-card/50 rounded-lg border border-border/20">
                          <p className="text-xs text-muted-foreground mb-2">Username</p>
                          <p className="font-semibold text-lg">{user.username || 'Not set'}</p>
                        </div>
                        <div className="p-4 bg-card/50 rounded-lg border border-border/20">
                          <p className="text-xs text-muted-foreground mb-2">Full Name</p>
                          <p className="font-semibold text-lg">{user.fullName || 'Not set'}</p>
                        </div>
                        <div className="p-4 bg-card/50 rounded-lg border border-border/20 md:col-span-2">
                          <p className="text-xs text-muted-foreground mb-2">Email</p>
                          <p className="font-semibold">{user.email || 'Not set'}</p>
                        </div>
                      </div>
                      <Button 
                        className="gap-2 bg-primary/20 hover:bg-primary/30 text-primary w-full"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        <Edit2 size={16} />
                        Edit Profile
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Loading profile data...</p>
                  )}
                </div>
              )}
            </div>
          </Card>
      </TabsContent>

      {/* App Settings */}
      <TabsContent value="app" className="space-y-6 mt-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Palette size={20} className="text-primary" />
                  App Preferences
                </h3>
              </div>

              {settingsLoading ? (
                <p className="text-muted-foreground">Loading settings...</p>
              ) : userSettings ? (
                <div className="space-y-4">
                  {/* Timezone (Read-only) */}
                  <div>
                    <Label className="text-sm font-semibold">Timezone (Auto-Detected)</Label>
                    <div className="w-full mt-2 px-3 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground">
                      <p className="font-medium">{timezone}</p>
                    </div>
                  </div>

                  {/* Current Time */}
                  <div>
                    <Label className="text-sm font-semibold">Current Time</Label>
                    <div className="w-full mt-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-foreground flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      <p className="font-mono text-lg">{currentTime || '...loading'}</p>
                    </div>
                  </div>

                  {/* Theme */}
                  <div>
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Palette size={14} />
                      Theme
                    </Label>
                    <Select 
                      value={userSettings.theme}
                      onValueChange={(value) => {
                        setUserSettings({ ...userSettings, theme: value });
                        setTheme(value);
                      }}
                    >
                      <SelectTrigger className="w-full mt-2 bg-card/50 border-border/30">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon size={14} />
                            Dark
                          </div>
                        </SelectItem>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun size={14} />
                            Light
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Day Start Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Clock size={14} />
                        Day Start Time
                      </Label>
                      <Input
                        type="time"
                        value={userSettings.day_start_time}
                        onChange={(e) => setUserSettings({ ...userSettings, day_start_time: e.target.value })}
                        className="mt-2 bg-card/50 border-border/30"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Moon size={14} />
                        Day End Time
                      </Label>
                      <Input
                        type="time"
                        value={userSettings.day_end_time}
                        onChange={(e) => setUserSettings({ ...userSettings, day_end_time: e.target.value })}
                        className="mt-2 bg-card/50 border-border/30"
                      />
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/20">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-primary" />
                      <Label className="text-sm font-semibold">Enable Notifications</Label>
                    </div>
                    <Switch
                      checked={userSettings.notifications_enabled}
                      onCheckedChange={(checked) => setUserSettings({ ...userSettings, notifications_enabled: checked })}
                    />
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="w-full bg-primary/20 hover:bg-primary/30 text-primary"
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </div>
              ) : (
                <p className="text-destructive">Failed to load settings</p>
              )}
            </div>
          </Card>
      </TabsContent>

      {/* System Settings */}
      <TabsContent value="system" className="space-y-6 mt-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap size={20} className="text-primary" />
                  System Configuration
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/20">
                  <div>
                    <p className="font-semibold">Auto-Shift Incomplete Quests</p>
                    <p className="text-xs text-muted-foreground">Automatically move incomplete quests to the next day</p>
                  </div>
                  <Switch 
                    checked={userSettings?.allow_auto_shift ?? false}
                    onCheckedChange={(checked) => userSettings && setUserSettings({ ...userSettings, allow_auto_shift: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/20">
                  <div>
                    <p className="font-semibold">Apply Shift Penalties</p>
                    <p className="text-xs text-muted-foreground">Lose XP when shifting incomplete quests</p>
                  </div>
                  <Switch 
                    checked={userSettings?.allow_fixed_quests_shift ?? false}
                    onCheckedChange={(checked) => userSettings && setUserSettings({ ...userSettings, allow_fixed_quests_shift: checked })}
                  />
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="w-full bg-primary/20 hover:bg-primary/30 text-primary mt-4"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </Card>
      </TabsContent>

      {/* Rank Management */}
      <TabsContent value="ranks" className="space-y-6 mt-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy size={20} className="text-primary" />
                  Rank Management
                </h3>
              </div>

              <div className="p-4 bg-card/50 rounded-lg border border-border/20">
                <p className="font-semibold mb-4">Add New Rank</p>
                <div className="space-y-3">
                  <Input
                    placeholder="Rank name (e.g., SS-Rank)"
                    value={newRank.name}
                    onChange={(e) => setNewRank({ ...newRank, name: e.target.value })}
                    className="bg-card/50 border-border/30"
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newRank.color}
                      onChange={(e) => setNewRank({ ...newRank, color: e.target.value })}
                      className="w-12 h-10 rounded-lg cursor-pointer"
                    />
                    <Button 
                      className="flex-1 gap-2 bg-secondary/20 hover:bg-secondary/30 text-secondary"
                      onClick={handleAddRank}
                    >
                      <Plus size={16} />
                      Add Rank
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-sm">Current Ranks</p>
                {ranks.map(rank => (
                  <div key={rank.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/20">
                    <div className="flex items-center gap-3">
                      <GripVertical size={16} className="text-muted-foreground" />
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: rank.color }}
                      />
                      <span className="font-semibold">{rank.name}</span>
                      {rank.active && <Badge className="bg-accent/20 text-accent">Active</Badge>}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteRank(rank.id)}
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
      </TabsContent>

      {/* Rank Progression Rules */}
      <TabsContent value="progression" className="space-y-6 mt-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Bell size={20} className="text-primary" />
                  Rank Progression Rules
                </h3>
              </div>

              <div className="p-4 bg-card/50 rounded-lg border border-border/20">
                <p className="font-semibold mb-4">Add Progression Rule</p>
                <div className="space-y-3">
                  <Select 
                    value={newProgression.fromRankId}
                    onValueChange={(value) => setNewProgression({ ...newProgression, fromRankId: value })}
                  >
                    <SelectTrigger className="w-full bg-card/50 border-border/30">
                      <SelectValue placeholder="Select From Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map(r => (
                        <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={newProgression.toRankId}
                    onValueChange={(value) => setNewProgression({ ...newProgression, toRankId: value })}
                  >
                    <SelectTrigger className="w-full bg-card/50 border-border/30">
                      <SelectValue placeholder="Select To Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map(r => (
                        <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min="1"
                    placeholder="Required Level"
                    value={newProgression.requiredLevel}
                    onChange={(e) => setNewProgression({ ...newProgression, requiredLevel: parseInt(e.target.value) })}
                    className="bg-card/50 border-border/30"
                  />

                  <Button 
                    className="w-full gap-2 bg-secondary/20 hover:bg-secondary/30 text-secondary"
                    onClick={handleAddProgression}
                  >
                    <Plus size={16} />
                    Add Rule
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-sm">Progression Rules</p>
                {progressionRules.length > 0 ? (
                  progressionRules.map(prog => {
                    const fromRank = ranks.find(r => r.id === prog.from_rank_id);
                    const toRank = ranks.find(r => r.id === prog.to_rank_id);
  // Show loading state while fetching user data and settings
  const isInitialLoading = userLoading || !user;
  const isSettingsDataLoading = settingsLoading || ranksLoading;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="w-12 h-12 border-4 border-border/30 border-t-primary rounded-full animate-spin" />
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold">Loading Settings</p>
          <p className="text-sm text-muted-foreground">Fetching your profile and preferences...</p>
        </div>
      </div>
    );
  }

  return (
                      <div key={prog.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/20">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{fromRank?.name} → {toRank?.name}</span>
                          <Badge className="bg-primary/20 text-primary">Level {prog.required_level}</Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No progression rules yet</p>
                )}
              </div>
            </div>
          </Card>
      </TabsContent>
    </Tabs>
  );
}
