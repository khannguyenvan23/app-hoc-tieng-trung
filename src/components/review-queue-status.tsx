import type {
  ReviewQueueKey,
  ReviewQueueStats,
} from "@/lib/review-queue-stats";

type ReviewQueueStatusProps = {
  itemName: string;
  stats: ReviewQueueStats;
  // Bucket of the card currently on screen; that counter gets emphasised.
  active?: ReviewQueueKey | null;
};

// Idle panels stay neutral so only the dot and the number carry colour; the
// card in play is the one tinted. Three filled pastel panels next to four
// tinted rating buttons made the screen read as noise.
const queueItems = [
  {
    key: "new",
    label: "Mới",
    numberClassName: "text-sky-700 dark:text-sky-300",
    panelClassName: "border-zinc-200/70 bg-white dark:bg-[#171a19] dark:border-white/10 dark:bg-white/[0.03]",
    activePanelClassName: "border-sky-300 bg-sky-50 dark:bg-sky-500/15 dark:border-sky-500/60",
    dotClassName: "bg-sky-500",
  },
  {
    key: "learning",
    label: "Đang ôn",
    numberClassName: "text-red-700 dark:text-red-300",
    panelClassName:
      "border-zinc-200/70 bg-white dark:bg-[#171a19] dark:border-white/10 dark:bg-white/[0.03]",
    activePanelClassName: "border-red-300 bg-red-50 dark:bg-red-500/15 dark:border-red-500/60",
    dotClassName: "bg-red-500",
  },
  {
    key: "review",
    label: "Review",
    numberClassName: "text-emerald-700 dark:text-emerald-300",
    panelClassName:
      "border-zinc-200/70 bg-white dark:bg-[#171a19] dark:border-white/10 dark:bg-white/[0.03]",
    activePanelClassName: "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 dark:border-emerald-500/60",
    dotClassName: "bg-emerald-500",
  },
] as const;

export function ReviewQueueStatus({
  itemName,
  stats,
  active,
}: ReviewQueueStatusProps) {
  return (
    <div
      aria-label={`${itemName} mới ${stats.new}, ${itemName} đang ôn ${stats.learning}, ${itemName} cần review ${stats.review}`}
      className="mx-auto mt-3 w-full max-w-md rounded-[var(--radius-lg)] border border-zinc-200/70 bg-white/90 p-1 dark:border-white/10 dark:bg-white/[0.04] shadow-[var(--shadow-md)] backdrop-blur"
      role="status"
    >
      <div className="grid grid-cols-3 gap-1">
        {queueItems.map((item) => {
          const isActive = active === item.key;

          return (
            <div
              aria-current={isActive ? "true" : undefined}
              className={`min-w-0 rounded-[var(--radius-md)] border px-2 py-2 text-center transition-colors ${
                isActive ? item.activePanelClassName : item.panelClassName
              }`}
              key={item.key}
              title={`${item.label}: ${stats[item.key]}`}
            >
              <div
                className={`flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide ${
                  isActive
                    ? "font-bold text-zinc-900 dark:text-zinc-100 dark:text-zinc-50"
                    : "font-medium text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${item.dotClassName}`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              <div
                className={`mt-0.5 leading-none ${item.numberClassName} ${
                  isActive ? "text-xl font-bold" : "text-lg font-semibold"
                }`}
              >
                {stats[item.key]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
