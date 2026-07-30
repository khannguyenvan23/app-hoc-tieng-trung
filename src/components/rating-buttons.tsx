import { getNextReview } from "@/lib/review";
import {
  formatReviewIntervalLabel,
  type StudySettings,
} from "@/lib/study-settings";
import type { ReviewRating } from "@/lib/types";

type RatingReview = {
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
  learning_step?: number | null;
};

type RatingOption = {
  rating: ReviewRating;
  label: string;
  tone: string;
  accent: string;
  shortcut: string;
};

const ratingOptions: RatingOption[] = [
  {
    rating: "again",
    label: "Quên",
    tone: "rating-again",
    accent: "text-rose-600 dark:text-rose-300",
    shortcut: "1",
  },
  {
    rating: "good",
    label: "Nhớ",
    tone: "rating-good",
    accent: "text-blue-600 dark:text-blue-300",
    shortcut: "2",
  },
  {
    rating: "easy",
    label: "Dễ",
    tone: "rating-easy",
    accent: "text-emerald-600 dark:text-emerald-300",
    shortcut: "3",
  },
];

function getRatingIntervalLabel(
  rating: ReviewRating,
  review: RatingReview,
  settings: StudySettings,
) {
  const now = new Date();
  const nextReview = getNextReview(rating, review, now, settings);

  return formatReviewIntervalLabel(
    nextReview.next_review_at,
    nextReview.interval_days,
    now,
  );
}

type RatingButtonsProps = {
  review: RatingReview;
  settings: StudySettings;
  onRate: (rating: ReviewRating) => void;
  disabled?: boolean;
};

export function RatingButtons({
  review,
  settings,
  onRate,
  disabled,
}: RatingButtonsProps) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {ratingOptions.map((option) => (
        <button
          className={`rating-button ${option.tone} px-3 py-2.5 disabled:opacity-60`}
          disabled={disabled}
          key={option.rating}
          onClick={() => onRate(option.rating)}
          type="button"
        >
          <span className="flex items-center justify-between gap-2">
            <span className={`text-[15px] font-semibold leading-none ${option.accent}`}>
              {option.label}
            </span>
            <kbd aria-hidden="true" className="rating-kbd">
              {option.shortcut}
            </kbd>
          </span>
          <span className="mt-1.5 block text-left text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
            {getRatingIntervalLabel(option.rating, review, settings)}
          </span>
        </button>
      ))}
    </div>
  );
}
