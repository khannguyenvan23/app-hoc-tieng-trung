function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function StudyCardSkeleton() {
  return (
    <section
      aria-label="Dang tai noi dung hoc"
      className="study-card min-w-0 overflow-hidden p-4 sm:p-5"
    >
      <SkeletonBlock className="h-4 w-20" />

      <div className="mt-8 flex flex-col items-center">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="mt-4 h-8 w-52 max-w-full" />
      </div>

      <div className="study-answer-panel mt-8 flex min-h-48 flex-col items-center justify-center p-5">
        <SkeletonBlock className="h-14 w-36 max-w-full" />
        <SkeletonBlock className="mt-5 h-5 w-24" />
        <SkeletonBlock className="mt-7 h-10 w-32" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock className="h-14" key={index} />
        ))}
      </div>
    </section>
  );
}

export function DeckGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div className="app-surface rounded-xl p-5" key={index}>
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="mt-4 h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export function CommunityDeckSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <article className="app-surface rounded-xl p-5" key={index}>
          <div className="flex items-start justify-between gap-3">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="mt-4 h-4 w-40" />
          <SkeletonBlock className="mt-5 h-10 w-28" />
        </article>
      ))}
    </div>
  );
}

export function WeakItemsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div className="app-surface-muted rounded-xl p-4" key={index}>
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock className="h-6 w-16 rounded-full" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <SkeletonBlock className="mt-4 h-7 w-24" />
          <SkeletonBlock className="mt-3 h-4 w-full" />
          <SkeletonBlock className="mt-4 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function HskProgressSkeleton() {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          className="rounded-md border border-zinc-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4"
          key={index}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="mt-2 h-3 w-28" />
            </div>
            <SkeletonBlock className="h-8 w-12" />
          </div>
          <SkeletonBlock className="mt-4 h-2 w-full rounded-full" />
          <SkeletonBlock className="mt-4 h-4 w-32" />
          <SkeletonBlock className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function SharedDeckPreviewSkeleton() {
  return (
    <div className="space-y-8">
      <section className="border-b border-zinc-200 dark:border-white/10 pb-7">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-4 h-9 w-64 max-w-full" />
        <SkeletonBlock className="mt-4 h-4 w-48" />
        <SkeletonBlock className="mt-6 h-11 w-40" />
      </section>
      <section>
        <SkeletonBlock className="h-6 w-44" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="border-b border-zinc-200 dark:border-white/10 pb-4" key={index}>
              <SkeletonBlock className="h-5 w-4/5" />
              <SkeletonBlock className="mt-3 h-5 w-3/5" />
              <SkeletonBlock className="mt-2 h-4 w-2/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

