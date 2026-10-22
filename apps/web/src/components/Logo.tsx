import { cx } from './ui';

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cx('flex items-center justify-center rounded-full border border-primary/60 bg-primary/10 shadow-halo-green', size === 'lg' ? 'h-10 w-10' : 'h-7 w-7')}>
        <span className={cx('rounded-full bg-primary', size === 'lg' ? 'h-3 w-3' : 'h-2 w-2')} />
      </span>
      <span className={cx('font-semibold tracking-tight', size === 'lg' ? 'text-3xl' : 'text-base')}>Córtex</span>
    </span>
  );
}
