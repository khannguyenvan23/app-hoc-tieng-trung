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

const queueItems = [
  {
    key: "new",
    label: "Mới",
    numberClassName: "text-sky-700",
    panelClassName: "border-sky-100 bg-sky-50",
    activePanelClassName: "border-sky-400 bg-sky-100 ring-1 ring-sky-300",
    dotClassName: "bg-sky-500",
  },
  {
    key: "learning",
    label: "Đang ôn",
    numberClassName: "text-red-700",
    panelClassName: "border-red-100 bg-red-50",
    activePanelClassName: "border-red-400 bg-red-100 ring-1 ring-red-300",
    dotClassName: "bg-red-500",
  },
  {
    key: "review",
    label: "Review",
    numberClassName: "text-emerald-700",
    panelClassName: "border-emerald-100 bg-emerald-50",
    activePanelClassName:
      "border-emerald-400 bg-emerald-100 ring-1 ring-emerald-300",
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
      className="mx-auto mt-3 w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-1 shadow-[0_10px_28px_rgba(24,24,27,0.08)] backdrop-blur"
      role="status"
    >
      <div className="grid grid-cols-3 gap-1">
        {queueItems.map((item) => {
          const isActive = active === item.key;

          return (
            <div
              aria-current={isActive ? "true" : undefined}
              className={`min-w-0 rounded-xl border px-2 py-2 text-center transition-colors ${
                isActive ? item.activePanelClassName : item.panelClassName
              }`}
              key={item.key}
              title={`${item.label}: ${stats[item.key]}`}
            >
              <div
                className={`flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide ${
                  isActive
                    ? "font-bold text-zinc-900"
                    : "font-medium text-zinc-600"
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
