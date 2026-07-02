create table if not exists public.template_decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  level text,
  created_at timestamp with time zone default now()
);

create table if not exists public.template_cards (
  id uuid primary key default gen_random_uuid(),
  template_deck_id uuid not null references public.template_decks(id) on delete cascade,
  chinese text not null,
  pinyin text,
  meaning_vi text,
  example_cn text,
  example_pinyin text,
  example_vi text,
  position integer default 0,
  created_at timestamp with time zone default now(),
  unique (template_deck_id, chinese)
);

create index if not exists template_cards_template_deck_id_idx
  on public.template_cards(template_deck_id);

alter table public.template_decks enable row level security;
alter table public.template_cards enable row level security;

drop policy if exists "Anyone can read template decks" on public.template_decks;
create policy "Anyone can read template decks"
  on public.template_decks for select
  using (true);

drop policy if exists "Anyone can read template cards" on public.template_cards;
create policy "Anyone can read template cards"
  on public.template_cards for select
  using (true);

insert into public.template_decks (slug, name, description, level)
values
  (
    'hsk2-co-ban',
    'HSK2 cơ bản',
    'Bộ từ vựng nền tảng cho người mới học HSK2.',
    'HSK2'
  ),
  (
    'an-uong',
    'Ăn uống',
    'Các từ thường gặp khi nói về món ăn, mùi vị và gọi món.',
    'Chủ đề'
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = 'hsk2-co-ban'
)
insert into public.template_cards (
  template_deck_id,
  chinese,
  pinyin,
  meaning_vi,
  example_cn,
  example_pinyin,
  example_vi,
  position
)
select
  target_deck.id,
  card.chinese,
  card.pinyin,
  card.meaning_vi,
  card.example_cn,
  card.example_pinyin,
  card.example_vi,
  card.position
from target_deck
cross join (
  values
    ('过', 'guò', 'qua, trải qua, từng', '我去过中国。', 'Wǒ qù guò Zhōngguó.', 'Tôi đã từng đi Trung Quốc.', 1),
    ('准备', 'zhǔnbèi', 'chuẩn bị', '我准备学习中文。', 'Wǒ zhǔnbèi xuéxí Zhōngwén.', 'Tôi chuẩn bị học tiếng Trung.', 2),
    ('觉得', 'juéde', 'cảm thấy, cho rằng', '我觉得中文很有意思。', 'Wǒ juéde Zhōngwén hěn yǒu yìsi.', 'Tôi cảm thấy tiếng Trung rất thú vị.', 3),
    ('希望', 'xīwàng', 'hy vọng', '我希望明天不下雨。', 'Wǒ xīwàng míngtiān bù xià yǔ.', 'Tôi hy vọng ngày mai không mưa.', 4),
    ('可能', 'kěnéng', 'có thể', '他可能今天很忙。', 'Tā kěnéng jīntiān hěn máng.', 'Hôm nay anh ấy có thể rất bận.', 5),
    ('帮助', 'bāngzhù', 'giúp đỡ', '谢谢你的帮助。', 'Xièxie nǐ de bāngzhù.', 'Cảm ơn sự giúp đỡ của bạn.', 6),
    ('问题', 'wèntí', 'vấn đề, câu hỏi', '这个问题不难。', 'Zhège wèntí bù nán.', 'Câu hỏi này không khó.', 7),
    ('时间', 'shíjiān', 'thời gian', '你有时间吗？', 'Nǐ yǒu shíjiān ma?', 'Bạn có thời gian không?', 8)
) as card(chinese, pinyin, meaning_vi, example_cn, example_pinyin, example_vi, position)
on conflict (template_deck_id, chinese) do update
set
  pinyin = excluded.pinyin,
  meaning_vi = excluded.meaning_vi,
  example_cn = excluded.example_cn,
  example_pinyin = excluded.example_pinyin,
  example_vi = excluded.example_vi,
  position = excluded.position;

with target_deck as (
  select id from public.template_decks where slug = 'an-uong'
)
insert into public.template_cards (
  template_deck_id,
  chinese,
  pinyin,
  meaning_vi,
  example_cn,
  example_pinyin,
  example_vi,
  position
)
select
  target_deck.id,
  card.chinese,
  card.pinyin,
  card.meaning_vi,
  card.example_cn,
  card.example_pinyin,
  card.example_vi,
  card.position
from target_deck
cross join (
  values
    ('好吃', 'hǎochī', 'ngon', '这个菜很好吃。', 'Zhège cài hěn hǎochī.', 'Món này rất ngon.', 1),
    ('味道', 'wèidào', 'mùi vị', '这个汤味道不错。', 'Zhège tāng wèidào búcuò.', 'Món canh này có vị khá ngon.', 2),
    ('菜单', 'càidān', 'thực đơn', '请给我菜单。', 'Qǐng gěi wǒ càidān.', 'Làm ơn cho tôi thực đơn.', 3),
    ('饮料', 'yǐnliào', 'đồ uống', '你想喝什么饮料？', 'Nǐ xiǎng hē shénme yǐnliào?', 'Bạn muốn uống đồ uống gì?', 4),
    ('米饭', 'mǐfàn', 'cơm', '我想要一碗米饭。', 'Wǒ xiǎng yào yì wǎn mǐfàn.', 'Tôi muốn một bát cơm.', 5),
    ('水果', 'shuǐguǒ', 'trái cây', '我每天吃水果。', 'Wǒ měitiān chī shuǐguǒ.', 'Mỗi ngày tôi ăn trái cây.', 6)
) as card(chinese, pinyin, meaning_vi, example_cn, example_pinyin, example_vi, position)
on conflict (template_deck_id, chinese) do update
set
  pinyin = excluded.pinyin,
  meaning_vi = excluded.meaning_vi,
  example_cn = excluded.example_cn,
  example_pinyin = excluded.example_pinyin,
  example_vi = excluded.example_vi,
  position = excluded.position;
