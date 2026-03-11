'use client';

import { Bell, Search, Flame, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { logout } from '@/app/actions/auth';
import { useUser } from '@/components/user-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user } = useUser();

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getAvatarInitial = () => user?.username?.charAt(0).toUpperCase() || 'U';
  const xpPercentage = user ? (user.currentXP / user.requiredXP) * 100 : 0;

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Panel</h1>
            <p className="text-sm text-muted-foreground">{currentDate}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Streak indicator */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/50 hover:border-accent/50 transition-colors">
              <Flame size={18} className="text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Streak</p>
                <p className="font-bold text-foreground glow-success">{user?.streakDays || 0} {user?.streakDays === 1 ? 'Day' : 'Days'}</p>
              </div>
            </div>

            {/* Notification */}
            <Button
              size="icon"
              variant="ghost"
              className="relative hover:bg-card"
            >
              <Bell size={20} className="text-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="hover:bg-card"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                      {getAvatarInitial()}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="flex items-center gap-2 text-foreground hover:bg-card/80 hover:text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search and Level Progress */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative hidden md:flex">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search quests, tasks..."
              className="pl-10 bg-card border-border/50 focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Level Progress */}
          <div className="flex-1 md:flex-none md:w-48">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">Level {user?.level || 1}</label>
              <span className="text-xs text-muted-foreground">{user?.currentXP || 0} / {user?.requiredXP || 5000} XP</span>
            </div>
            <Progress value={xpPercentage} className="h-2 bg-card border border-border/50" />
          </div>
        </div>
      </div>
    </header>
  );
}
