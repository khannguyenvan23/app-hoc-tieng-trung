import type { ReviewQueueStats } from "@/lib/review-queue-stats";

type ReviewQueueStatusProps = {
  itemName: string;
  stats: ReviewQueueStats;
};

const queueItems = [
  {
    key: "new",
    label: "Mới",
    numberClassName: "text-sky-700",
    panelClassName: "border-sky-100 bg-sky-50",
    dotClassName: "bg-sky-500",
  },
  {
    key: "learning",
    label: "Đang ôn",
    numberClassName: "text-red-700",
    panelClassName: "border-red-100 bg-red-50",
    dotClassName: "bg-red-500",
  },
  {
    key: "review",
    label: "Review",
    numberClassName: "text-emerald-700",
    panelClassName: "border-emerald-100 bg-emerald-50",
    dotClassName: "bg-emerald-500",
  },
] as const;

export function ReviewQueueStatus({
  itemName,
  stats,
}: ReviewQueueStatusProps) {
  return (
    <div
      aria-label={`${itemName} mới ${stats.new}, ${itemName} đang ôn ${stats.learning}, ${itemName} cần review ${stats.review}`}
      className="app-surface mx-auto mt-3 w-full max-w-md rounded-xl p-1"
      role="status"
    >
      <div className="grid grid-cols-3 gap-1">
        {queueItems.map((item) => (
          <div
            className={`min-w-0 rounded-lg border px-2 py-2 text-center ${item.panelClassName}`}
            key={item.key}
            title={`${item.label}: ${stats[item.key]}`}
          >
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${item.dotClassName}`}
              />
              <span className="truncate">{item.label}</span>
            </div>
            <div
              className={`mt-0.5 text-lg font-semibold leading-none ${item.numberClassName}`}
            >
              {stats[item.key]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
