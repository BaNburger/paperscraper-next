import type { ReactNode } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { cn } from '../../lib/cn';

function ScreenState({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="pt-4 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  return <ScreenState>{label}</ScreenState>;
}

export function ErrorState({ message }: { message: string }) {
  return <ScreenState className="border-destructive/50 bg-destructive/5 text-destructive">{message}</ScreenState>;
}

export function EmptyState({ label }: { label: string }) {
  return <ScreenState>{label}</ScreenState>;
}
