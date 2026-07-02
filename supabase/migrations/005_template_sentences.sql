create table if not exists public.template_sentence_cards (
  id uuid primary key default gen_random_uuid(),
  template_deck_id uuid not null references public.template_decks(id) on delete cascade,
  sentence_cn text not null,
  sentence_pinyin text,
  sentence_vi text,
  vocab_json jsonb,
  position integer default 0,
  created_at timestamp with time zone default now(),
  unique (template_deck_id, sentence_cn)
);

create index if not exists template_sentence_cards_template_deck_id_idx
  on public.template_sentence_cards(template_deck_id);

alter table public.template_sentence_cards enable row level security;

drop policy if exists "Anyone can read template sentence cards" on public.template_sentence_cards;
create policy "Anyone can read template sentence cards"
  on public.template_sentence_cards for select
  using (true);

with target_deck as (
  select id from public.template_decks where slug = 'hsk2-co-ban'
)
insert into public.template_sentence_cards (
  template_deck_id,
  sentence_cn,
  sentence_pinyin,
  sentence_vi,
  vocab_json,
  position
)
select
  target_deck.id,
  card.sentence_cn,
  card.sentence_pinyin,
  card.sentence_vi,
  card.vocab_json::jsonb,
  card.position
from target_deck
cross join (
  values
    (
      '我去过中国。',
      'Wǒ qù guò Zhōngguó.',
      'Tôi đã từng đi Trung Quốc.',
      '[{"chinese":"我","pinyin":"wǒ","meaning_vi":"tôi"},{"chinese":"去过","pinyin":"qù guò","meaning_vi":"đã từng đi"},{"chinese":"中国","pinyin":"Zhōngguó","meaning_vi":"Trung Quốc"}]',
      1
    ),
    (
      '我准备学习中文。',
      'Wǒ zhǔnbèi xuéxí Zhōngwén.',
      'Tôi chuẩn bị học tiếng Trung.',
      '[{"chinese":"准备","pinyin":"zhǔnbèi","meaning_vi":"chuẩn bị"},{"chinese":"学习","pinyin":"xuéxí","meaning_vi":"học"},{"chinese":"中文","pinyin":"Zhōngwén","meaning_vi":"tiếng Trung"}]',
      2
    ),
    (
      '这个问题不难。',
      'Zhège wèntí bù nán.',
      'Câu hỏi này không khó.',
      '[{"chinese":"这个","pinyin":"zhège","meaning_vi":"cái này"},{"chinese":"问题","pinyin":"wèntí","meaning_vi":"vấn đề, câu hỏi"},{"chinese":"不难","pinyin":"bù nán","meaning_vi":"không khó"}]',
      3
    )
) as card(sentence_cn, sentence_pinyin, sentence_vi, vocab_json, position)
on conflict (template_deck_id, sentence_cn) do update
set
  sentence_pinyin = excluded.sentence_pinyin,
  sentence_vi = excluded.sentence_vi,
  vocab_json = excluded.vocab_json,
  position = excluded.position;

with target_deck as (
  select id from public.template_decks where slug = 'an-uong'
)
insert into public.template_sentence_cards (
  template_deck_id,
  sentence_cn,
  sentence_pinyin,
  sentence_vi,
  vocab_json,
  position
)
select
  target_deck.id,
  card.sentence_cn,
  card.sentence_pinyin,
  card.sentence_vi,
  card.vocab_json::jsonb,
  card.position
from target_deck
cross join (
  values
    (
      '这个菜很好吃。',
      'Zhège cài hěn hǎochī.',
      'Món này rất ngon.',
      '[{"chinese":"这个","pinyin":"zhège","meaning_vi":"cái này"},{"chinese":"菜","pinyin":"cài","meaning_vi":"món ăn"},{"chinese":"好吃","pinyin":"hǎochī","meaning_vi":"ngon"}]',
      1
    ),
    (
      '请给我菜单。',
      'Qǐng gěi wǒ càidān.',
      'Làm ơn cho tôi thực đơn.',
      '[{"chinese":"请","pinyin":"qǐng","meaning_vi":"làm ơn"},{"chinese":"给我","pinyin":"gěi wǒ","meaning_vi":"đưa cho tôi"},{"chinese":"菜单","pinyin":"càidān","meaning_vi":"thực đơn"}]',
      2
    ),
    (
      '你想喝什么饮料？',
      'Nǐ xiǎng hē shénme yǐnliào?',
      'Bạn muốn uống đồ uống gì?',
      '[{"chinese":"想喝","pinyin":"xiǎng hē","meaning_vi":"muốn uống"},{"chinese":"什么","pinyin":"shénme","meaning_vi":"cái gì"},{"chinese":"饮料","pinyin":"yǐnliào","meaning_vi":"đồ uống"}]',
      3
    )
) as card(sentence_cn, sentence_pinyin, sentence_vi, vocab_json, position)
on conflict (template_deck_id, sentence_cn) do update
set
  sentence_pinyin = excluded.sentence_pinyin,
  sentence_vi = excluded.sentence_vi,
  vocab_json = excluded.vocab_json,
  position = excluded.position;
