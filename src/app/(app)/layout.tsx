import { AppShell } from '@/components/app-client';

// The (app) section is fully client-driven (auth redirect, tabs). Opt out of
// the streaming prerender so client routing hooks are allowed.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
