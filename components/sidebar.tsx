'use client';

import { useState } from 'react';
import { 
  LayoutDashboard, Calendar, Zap, Gift, AlertTriangle, TrendingUp, Settings, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/components/user-context';
import Link from 'next/link';

const menuItems = [
  { icon: LayoutDashboard, label: 'System Panel', href: '/' },
  { icon: Calendar, label: 'Calendar', href: '/calendar' },
  { icon: Zap, label: 'Quests', href: '/quests' },
  { icon: Gift, label: 'Rewards Store', href: '/rewards' },
  { icon: AlertTriangle, label: 'Penalty Quests', href: '/penalties' },
  { icon: TrendingUp, label: 'Progress', href: '/progress' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();

  const getAvatarInitial = () => user?.username?.charAt(0).toUpperCase() || 'U';

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border hover:border-primary transition-colors"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap size={18} className="text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-sidebar-foreground glow-accent">
              Discipline
            </h1>
          </div>
          <p className="text-xs text-sidebar-foreground/60 mt-1">System v1.0</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="cursor-pointer">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-primary rounded-lg cursor-pointer"
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/10 border border-sidebar-border">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary-foreground">{getAvatarInitial()}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/60">Level {user?.level || 1} • {user?.rank || 'F-Rank'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
