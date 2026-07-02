alter table public.decks
  add column if not exists source_template_slug text;

with matched_template_decks as (
  select
    decks.id,
    template_decks.slug,
    row_number() over (
      partition by decks.user_id, template_decks.slug
      order by decks.created_at asc, decks.id asc
    ) as rank
  from public.decks
  join public.template_decks
    on lower(trim(public.decks.name)) = lower(trim(public.template_decks.name))
  where public.decks.source_template_slug is null
)
update public.decks
set source_template_slug = matched_template_decks.slug
from matched_template_decks
where public.decks.id = matched_template_decks.id
  and matched_template_decks.rank = 1;

create index if not exists decks_source_template_slug_idx
  on public.decks(user_id, source_template_slug)
  where source_template_slug is not null;

create unique index if not exists decks_user_template_unique_idx
  on public.decks(user_id, source_template_slug)
  where source_template_slug is not null;
