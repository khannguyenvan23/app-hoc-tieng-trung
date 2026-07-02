insert into public.template_decks (slug, name, description, level)
values (
  'hsk1-co-ban',
  'HSK1 cơ bản',
  'Bộ từ vựng nhập môn cho người mới bắt đầu học tiếng Trung.',
  'HSK1'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = 'hsk1-co-ban'
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
    ('我', 'wǒ', 'tôi', '我是学生。', 'Wǒ shì xuésheng.', 'Tôi là học sinh.', 1),
    ('你', 'nǐ', 'bạn', '你好吗？', 'Nǐ hǎo ma?', 'Bạn khỏe không?', 2),
    ('他', 'tā', 'anh ấy', '他是我的朋友。', 'Tā shì wǒ de péngyou.', 'Anh ấy là bạn của tôi.', 3),
    ('她', 'tā', 'cô ấy', '她很高兴。', 'Tā hěn gāoxìng.', 'Cô ấy rất vui.', 4),
    ('好', 'hǎo', 'tốt, khỏe', '今天天气很好。', 'Jīntiān tiānqì hěn hǎo.', 'Thời tiết hôm nay rất tốt.', 5),
    ('是', 'shì', 'là', '这是我的书。', 'Zhè shì wǒ de shū.', 'Đây là sách của tôi.', 6),
    ('不', 'bù', 'không', '我不是老师。', 'Wǒ bú shì lǎoshī.', 'Tôi không phải giáo viên.', 7),
    ('有', 'yǒu', 'có', '我有一个哥哥。', 'Wǒ yǒu yí ge gēge.', 'Tôi có một anh trai.', 8),
    ('在', 'zài', 'ở, đang', '我在家。', 'Wǒ zài jiā.', 'Tôi ở nhà.', 9),
    ('人', 'rén', 'người', '这里有很多人。', 'Zhèlǐ yǒu hěn duō rén.', 'Ở đây có rất nhiều người.', 10),
    ('中国', 'Zhōngguó', 'Trung Quốc', '我喜欢中国。', 'Wǒ xǐhuan Zhōngguó.', 'Tôi thích Trung Quốc.', 11),
    ('学生', 'xuésheng', 'học sinh, sinh viên', '他是学生。', 'Tā shì xuésheng.', 'Anh ấy là học sinh.', 12),
    ('老师', 'lǎoshī', 'giáo viên', '王老师很好。', 'Wáng lǎoshī hěn hǎo.', 'Thầy/cô Vương rất tốt.', 13),
    ('朋友', 'péngyou', 'bạn bè', '她是我的朋友。', 'Tā shì wǒ de péngyou.', 'Cô ấy là bạn của tôi.', 14),
    ('家', 'jiā', 'nhà, gia đình', '我家有三个人。', 'Wǒ jiā yǒu sān ge rén.', 'Nhà tôi có ba người.', 15),
    ('水', 'shuǐ', 'nước', '我想喝水。', 'Wǒ xiǎng hē shuǐ.', 'Tôi muốn uống nước.', 16),
    ('茶', 'chá', 'trà', '你喝茶吗？', 'Nǐ hē chá ma?', 'Bạn uống trà không?', 17),
    ('吃', 'chī', 'ăn', '我吃米饭。', 'Wǒ chī mǐfàn.', 'Tôi ăn cơm.', 18),
    ('喝', 'hē', 'uống', '他喝咖啡。', 'Tā hē kāfēi.', 'Anh ấy uống cà phê.', 19),
    ('看', 'kàn', 'xem, nhìn', '我看书。', 'Wǒ kàn shū.', 'Tôi đọc sách.', 20)
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
  select id from public.template_decks where slug = 'hsk1-co-ban'
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
      '我是学生。',
      'Wǒ shì xuésheng.',
      'Tôi là học sinh.',
      '[{"chinese":"我","pinyin":"wǒ","meaning_vi":"tôi"},{"chinese":"是","pinyin":"shì","meaning_vi":"là"},{"chinese":"学生","pinyin":"xuésheng","meaning_vi":"học sinh"}]',
      1
    ),
    (
      '你喝茶吗？',
      'Nǐ hē chá ma?',
      'Bạn uống trà không?',
      '[{"chinese":"你","pinyin":"nǐ","meaning_vi":"bạn"},{"chinese":"喝","pinyin":"hē","meaning_vi":"uống"},{"chinese":"茶","pinyin":"chá","meaning_vi":"trà"}]',
      2
    ),
    (
      '我家有三个人。',
      'Wǒ jiā yǒu sān ge rén.',
      'Nhà tôi có ba người.',
      '[{"chinese":"我家","pinyin":"wǒ jiā","meaning_vi":"nhà tôi"},{"chinese":"有","pinyin":"yǒu","meaning_vi":"có"},{"chinese":"三个人","pinyin":"sān ge rén","meaning_vi":"ba người"}]',
      3
    ),
    (
      '她是我的朋友。',
      'Tā shì wǒ de péngyou.',
      'Cô ấy là bạn của tôi.',
      '[{"chinese":"她","pinyin":"tā","meaning_vi":"cô ấy"},{"chinese":"我的","pinyin":"wǒ de","meaning_vi":"của tôi"},{"chinese":"朋友","pinyin":"péngyou","meaning_vi":"bạn"}]',
      4
    ),
    (
      '我想喝水。',
      'Wǒ xiǎng hē shuǐ.',
      'Tôi muốn uống nước.',
      '[{"chinese":"我","pinyin":"wǒ","meaning_vi":"tôi"},{"chinese":"想","pinyin":"xiǎng","meaning_vi":"muốn"},{"chinese":"喝水","pinyin":"hē shuǐ","meaning_vi":"uống nước"}]',
      5
    )
) as card(sentence_cn, sentence_pinyin, sentence_vi, vocab_json, position)
on conflict (template_deck_id, sentence_cn) do update
set
  sentence_pinyin = excluded.sentence_pinyin,
  sentence_vi = excluded.sentence_vi,
  vocab_json = excluded.vocab_json,
  position = excluded.position;
