import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { UserProvider } from '@/components/user-context'
import { Suspense } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Celebration } from '@/components/celebration'
import { Reminders } from '@/components/reminders'
import './globals.css'


export const metadata: Metadata = {
  title: 'Discipline — Your daily progress',
  description: 'A gamified productivity app where you schedule daily tasks, complete quests, earn XP and rewards, and maintain discipline. Track your progress like a real-life RPG.',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <UserProvider>
            <Suspense fallback={<div className="p-8" role="status">Loading your workspace…</div>}>{children}</Suspense>
            <Toaster richColors closeButton />
            <Celebration />
            <Reminders />
          </UserProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
