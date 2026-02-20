// React import not needed with React 17+ JSX transform

type Props = {
  message?: string | null;
  className?: string;
};

export function FieldErrorOverlay({ message, className }: Props) {
  if (!message) return null;
  return (
    <div
      className={[
        'absolute left-3 top-[calc(100%+2px)] z-20 rounded bg-background',
        'border border-destructive/30 px-2 py-0.5 text-xs text-destructive',
        'shadow-sm pointer-events-none',
        className ?? '',
      ].join(' ')}
    >
      {message}
    </div>
  );
}

export default FieldErrorOverlay;
