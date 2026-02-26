import type { ReactNode } from 'react';

function ScreenState({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={className ? `state ${className}` : 'state'}>{children}</p>;
}

export function LoadingState({ label }: { label: string }) {
  return <ScreenState>{label}</ScreenState>;
}

export function ErrorState({ message }: { message: string }) {
  return <ScreenState className="state-error">{message}</ScreenState>;
}

export function EmptyState({ label }: { label: string }) {
  return <ScreenState>{label}</ScreenState>;
}
