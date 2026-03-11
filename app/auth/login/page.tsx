'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      console.log('[v0] Starting login...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.log('[v0] Login error:', error.message);
        throw error;
      }
      
      console.log('[v0] Login successful, user:', data.user?.email);
      
      // Wait for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify session exists
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('[v0] Session established:', !!sessionData.session);
      
      // Redirect to system panel
      console.log('[v0] Redirecting to system-panel...');
      router.push('/system-panel');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      console.log('[v0] Error:', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-border bg-card/50 backdrop-blur card-glow">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold glow-accent">Discipline System</h1>
              <p className="text-muted-foreground">Sign in to your account</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {error && (
                <div className="flex gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/50">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">New to Discipline System?</span>
              </div>
            </div>

            {/* Sign up link */}
            <Button
              asChild
              variant="outline"
              className="w-full border-border/50 hover:bg-card/80 hover:border-primary/50"
            >
              <Link href="/auth/signup">Create an account</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
