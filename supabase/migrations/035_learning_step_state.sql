-- Track the current position inside the learning / relearning steps so the
-- scheduler can advance through multi-step learning the way Anki does.
-- learning_step >= 0  => card is in a learning (interval_days = 0) or
--                        relearning (interval_days > 0) phase, at that step index.
-- learning_step = -1  => card is a graduated review card (no active steps).

alter table public.reviews
  add column if not exists learning_step integer not null default 0;

alter table public.sentence_reviews
  add column if not exists learning_step integer not null default 0;

-- Existing graduated cards are already in the review phase, not mid-learning.
update public.reviews
  set learning_step = -1
  where interval_days > 0 and learning_step = 0;

update public.sentence_reviews
  set learning_step = -1
  where interval_days > 0 and learning_step = 0;
