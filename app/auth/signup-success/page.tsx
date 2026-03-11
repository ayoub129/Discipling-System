'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-border bg-card/50 backdrop-blur card-glow">
          <div className="p-8 space-y-6 text-center">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="p-3 rounded-lg bg-accent/20 border border-accent/50">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold glow-success">Account Created!</h1>
              <p className="text-muted-foreground">
                Your account has been created successfully. Please check your email to confirm your account before logging in.
              </p>
            </div>

            {/* Message */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-sm text-primary">
                A confirmation email has been sent to your email address. Click the link in the email to activate your account.
              </p>
            </div>

            {/* Action */}
            <Button
              asChild
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10"
            >
              <Link href="/auth/login">Go to Login</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
