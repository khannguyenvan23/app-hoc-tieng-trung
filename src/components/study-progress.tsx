type StudyProgressProps = {
  current: number;
  itemName: string;
  total: number;
};

export function StudyProgress({
  current,
  itemName,
  total,
}: StudyProgressProps) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(1, current), safeTotal);
  const progressPercent = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <div
      className="study-progress"
      aria-label={`${itemName} ${safeCurrent} / ${safeTotal}`}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-zinc-600 dark:text-zinc-400">
          {itemName} {safeCurrent} / {safeTotal}
        </span>
        <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-500/15 dark:text-teal-300">
          {progressPercent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-700 via-teal-500 to-sky-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
