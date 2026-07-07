-- Add HSK1 examples without overwriting content edited by users.
begin;

create temporary table hsk1_example_backfill (
  chinese text primary key,
  example_cn text not null,
  example_pinyin text not null,
  example_vi text not null
) on commit drop;

insert into hsk1_example_backfill (
  chinese,
  example_cn,
  example_pinyin,
  example_vi
)
values
  ('爱', '我爱我的家。', 'Wǒ ài wǒ de jiā.', 'Tôi yêu gia đình của tôi.'),
  ('八', '我有八本书。', 'Wǒ yǒu bā běn shū.', 'Tôi có tám quyển sách.'),
  ('爸爸', '爸爸在家。', 'Bàba zài jiā.', 'Bố ở nhà.'),
  ('杯子', '我有一个杯子。', 'Wǒ yǒu yí ge bēizi.', 'Tôi có một cái cốc.'),
  ('北京', '我去北京旅游。', 'Wǒ qù Běijīng lǚyóu.', 'Tôi đi du lịch Bắc Kinh.'),
  ('本', '我有三本书。', 'Wǒ yǒu sān běn shū.', 'Tôi có ba quyển sách.'),
  ('不客气', '谢谢你！不客气。', 'Xièxie nǐ! Bú kèqi.', 'Cảm ơn bạn! Không có gì.'),
  ('不', '我不喜欢喝咖啡。', 'Wǒ bù xǐhuān hē kāfēi.', 'Tôi không thích uống cà phê.'),
  ('菜', '我喜欢吃中国菜。', 'Wǒ xǐhuān chī Zhōngguó cài.', 'Tôi thích ăn món ăn Trung Quốc.'),
  ('茶', '我喜欢喝茶。', 'Wǒ xǐhuān hē chá.', 'Tôi thích uống trà.'),
  ('吃', '我喜欢吃苹果。', 'Wǒ xǐhuān chī píngguǒ.', 'Tôi thích ăn táo.'),
  ('出租车', '我坐出租车去学校。', 'Wǒ zuò chūzūchē qù xuéxiào.', 'Tôi đi taxi đến trường.'),
  ('打电话', '我给妈妈打电话。', 'Wǒ gěi māma dǎ diànhuà.', 'Tôi gọi điện thoại cho mẹ.'),
  ('大', '这是一只大狗。', 'Zhè shì yì zhī dà gǒu.', 'Đây là một con chó lớn.'),
  ('的', '这是我的书。', 'Zhè shì wǒ de shū.', 'Đây là sách của tôi.'),
  ('点', '现在三点了。', 'Xiànzài sān diǎn le.', 'Bây giờ là ba giờ rồi.'),
  ('电脑', '我有一台新的电脑。', 'Wǒ yǒu yī tái xīn de diànnǎo.', 'Tôi có một chiếc máy tính mới.'),
  ('电视', '我喜欢看电视。', 'Wǒ xǐhuān kàn diànshì.', 'Tôi thích xem tivi.'),
  ('电影', '我喜欢看电影。', 'Wǒ xǐhuān kàn diànyǐng.', 'Tôi thích xem phim.'),
  ('东西', '这个东西很贵。', 'Zhè ge dōngxi hěn guì.', 'Đồ vật này rất đắt.'),
  ('都', '我们都喜欢吃苹果。', 'Wǒmen dōu xǐhuān chī píngguǒ.', 'Chúng tôi đều thích ăn táo.'),
  ('读', '我喜欢读书。', 'Wǒ xǐhuān dú shū.', 'Tôi thích đọc sách.'),
  ('对不起', '对不起，我迟到了。', 'Duìbuqǐ, wǒ chídào le.', 'Xin lỗi, tôi đến muộn rồi.'),
  ('多', '你有很多朋友。', 'Nǐ yǒu hěn duō péngyǒu.', 'Bạn có nhiều bạn bè.'),
  ('多少', '你有多少本书？', 'Nǐ yǒu duōshao běn shū?', 'Bạn có bao nhiêu quyển sách?'),
  ('儿子', '我有一个儿子。', 'Wǒ yǒu yí gè érzi.', 'Tôi có một con trai.'),
  ('二', '二加二等于四。', 'Èr jiā èr děngyú sì.', 'Hai cộng hai bằng bốn.'),
  ('饭馆', '我们去饭馆吃饭。', 'Wǒmen qù fànguǎn chīfàn.', 'Chúng ta đi nhà hàng ăn cơm.'),
  ('飞机', '我坐飞机去北京。', 'Wǒ zuò fēijī qù Běijīng.', 'Tôi đi máy bay đến Bắc Kinh.'),
  ('分钟', '我等了五分钟。', 'Wǒ děngle wǔ fēnzhōng.', 'Tôi đã đợi năm phút.'),
  ('高兴', '我很高兴认识你。', 'Wǒ hěn gāoxìng rènshí nǐ.', 'Tôi rất vui được làm quen với bạn.'),
  ('个', '我有三个苹果。', 'Wǒ yǒu sān gè píngguǒ.', 'Tôi có ba quả táo.'),
  ('工作', '我在公司工作。', 'Wǒ zài gōngsī gōngzuò.', 'Tôi làm việc ở công ty.'),
  ('狗', '我有一只狗。', 'Wǒ yǒu yì zhī gǒu.', 'Tôi có một con chó.'),
  ('汉语', '我学习汉语。', 'Wǒ xuéxí Hànyǔ.', 'Tôi học tiếng Hán.'),
  ('好', '我很好。', 'Wǒ hěn hǎo.', 'Tôi rất khỏe.'),
  ('号', '今天是三号。', 'Jīntiān shì sān hào.', 'Hôm nay là ngày mùng ba.'),
  ('喝', '我喝水。', 'Wǒ hē shuǐ.', 'Tôi uống nước.'),
  ('和', '我和你是朋友。', 'Wǒ hé nǐ shì péngyǒu.', 'Tôi và bạn là bạn bè.'),
  ('很', '我很高兴。', 'Wǒ hěn gāoxìng.', 'Tôi rất vui.'),
  ('后面', '学校后面有一个公园。', 'Xuéxiào hòumiàn yǒu yí gè gōngyuán.', 'Phía sau trường học có một công viên.'),
  ('回', '我下午三点回家。', 'Wǒ xiàwǔ sān diǎn huí jiā.', 'Tôi sẽ về nhà lúc 3 giờ chiều.'),
  ('会', '我会说中文。', 'Wǒ huì shuō Zhōngwén.', 'Tôi biết nói tiếng Trung.'),
  ('几', '你有几个苹果？', 'Nǐ yǒu jǐ gè píngguǒ?', 'Bạn có mấy quả táo?'),
  ('家', '我家有四口人。', 'Wǒ jiā yǒu sì kǒu rén.', 'Nhà tôi có bốn người.'),
  ('叫', '我叫李华。', 'Wǒ jiào Lǐ Huá.', 'Tôi tên là Lý Hoa.'),
  ('今天', '今天我去学校。', 'Jīntiān wǒ qù xuéxiào.', 'Hôm nay tôi đi đến trường.'),
  ('九', '我有九本书。', 'Wǒ yǒu jiǔ běn shū.', 'Tôi có chín quyển sách.'),
  ('开', '我开门。', 'Wǒ kāi mén.', 'Tôi mở cửa.'),
  ('看', '我喜欢看书。', 'Wǒ xǐhuān kàn shū.', 'Tôi thích đọc sách.'),
  ('看见', '我看见了小猫。', 'Wǒ kànjiàn le xiǎo māo.', 'Tôi nhìn thấy con mèo nhỏ.'),
  ('块', '我有一块钱。', 'Wǒ yǒu yí kuài qián.', 'Tôi có một tệ.'),
  ('来', '他来学校。', 'Tā lái xuéxiào.', 'Anh ấy đến trường.'),
  ('老师', '老师在教室里。', 'Lǎoshī zài jiàoshì lǐ.', 'Giáo viên đang ở trong lớp học.'),
  ('了', '我吃了饭。', 'Wǒ chī le fàn.', 'Tôi đã ăn cơm rồi.'),
  ('冷', '今天很冷。', 'Jīntiān hěn lěng.', 'Hôm nay rất lạnh.'),
  ('里', '书包里有书。', 'Shūbāo lǐ yǒu shū.', 'Trong cặp sách có sách.'),
  ('六', '我有六本书。', 'Wǒ yǒu liù běn shū.', 'Tôi có sáu cuốn sách.'),
  ('妈妈', '妈妈在家。', 'Māma zài jiā.', 'Mẹ ở nhà.'),
  ('吗', '你好吗？', 'Nǐ hǎo ma?', 'Bạn có khỏe không?'),
  ('买', '我想买苹果。', 'Wǒ xiǎng mǎi píngguǒ.', 'Tôi muốn mua táo.'),
  ('猫', '我有一只猫。', 'Wǒ yǒu yì zhī māo.', 'Tôi có một con mèo.'),
  ('没关系', '没关系，我可以帮你。', 'Méi guānxi, wǒ kěyǐ bāng nǐ.', 'Không sao, tôi có thể giúp bạn.'),
  ('没有', '我没有钱。', 'Wǒ méiyǒu qián.', 'Tôi không có tiền.'),
  ('米饭', '我喜欢吃米饭。', 'Wǒ xǐhuān chī mǐfàn.', 'Tôi thích ăn cơm.'),
  ('明天', '明天我去学校。', 'Míngtiān wǒ qù xuéxiào.', 'Ngày mai tôi đi học.'),
  ('名字', '你叫什么名字？', 'Nǐ jiào shénme míngzi?', 'Bạn tên là gì?'),
  ('哪', '你是哪国人？', 'Nǐ shì nǎ guó rén?', 'Bạn là người nước nào?'),
  ('哪儿', '你去哪儿？', 'Nǐ qù nǎr?', 'Bạn đi đâu?'),
  ('那', '那是我的书。', 'Nà shì wǒ de shū.', 'Kia là sách của tôi.'),
  ('呢', '你呢？', 'Nǐ ne?', 'Còn bạn thì sao?'),
  ('能', '我能说中文。', 'Wǒ néng shuō Zhōngwén.', 'Tôi có thể nói tiếng Trung.'),
  ('你', '你好吗？', 'Nǐ hǎo ma?', 'Bạn khỏe không?'),
  ('年', '一年有十二个月。', 'Yì nián yǒu shí''èr ge yuè.', 'Một năm có mười hai tháng.'),
  ('女儿', '我有一个女儿。', 'Wǒ yǒu yí gè nǚér.', 'Tôi có một con gái.'),
  ('朋友', '我是你的朋友。', 'Wǒ shì nǐ de péngyou.', 'Tôi là bạn của bạn.'),
  ('漂亮', '她的衣服很漂亮。', 'Tā de yīfu hěn piàoliang.', 'Quần áo của cô ấy rất đẹp.'),
  ('苹果', '我喜欢吃苹果。', 'Wǒ xǐhuān chī píngguǒ.', 'Tôi thích ăn táo.'),
  ('七', '我有七本书。', 'Wǒ yǒu qī běn shū.', 'Tôi có bảy quyển sách.'),
  ('钱', '我有很多钱。', 'Wǒ yǒu hěn duō qián.', 'Tôi có nhiều tiền.'),
  ('前面', '学校在前面。', 'Xuéxiào zài qiánmiàn.', 'Trường học ở phía trước.'),
  ('请', '请进！', 'Qǐng jìn!', 'Mời vào!'),
  ('去', '我去学校。', 'Wǒ qù xuéxiào.', 'Tôi đi đến trường.'),
  ('热', '今天很热。', 'Jīntiān hěn rè.', 'Hôm nay rất nóng.'),
  ('人', '他是一个好人。', 'Tā shì yí gè hǎo rén.', 'Anh ấy là một người tốt.'),
  ('认识', '我认识他。', 'Wǒ rènshi tā.', 'Tôi quen biết anh ấy.'),
  ('三', '我有三本书。', 'Wǒ yǒu sān běn shū.', 'Tôi có ba quyển sách.'),
  ('商店', '我去商店买东西。', 'Wǒ qù shāngdiàn mǎi dōngxi.', 'Tôi đến cửa hàng mua đồ.'),
  ('上', '书在桌子上。', 'Shū zài zhuōzi shàng.', 'Sách ở trên bàn.'),
  ('上午', '我上午去学校。', 'Wǒ shàngwǔ qù xuéxiào.', 'Tôi đi đến trường vào buổi sáng.'),
  ('少', '这里的人很少。', 'Zhèlǐ de rén hěn shǎo.', 'Ở đây có rất ít người.'),
  ('谁', '这是谁的书？', 'Zhè shì shéi de shū?', 'Đây là sách của ai?'),
  ('什么', '这是什么？', 'Zhè shì shénme?', 'Cái này là cái gì?'),
  ('十', '我有十本书。', 'Wǒ yǒu shí běn shū.', 'Tôi có mười quyển sách.'),
  ('时候', '你什么时候去学校？', 'Nǐ shénme shíhou qù xuéxiào?', 'Bạn đi học lúc nào?'),
  ('是', '我是学生。', 'Wǒ shì xuéshēng.', 'Tôi là học sinh.'),
  ('书', '我有一本书。', 'Wǒ yǒu yī běn shū.', 'Tôi có một cuốn sách.'),
  ('水', '我喝水。', 'Wǒ hē shuǐ.', 'Tôi uống nước.'),
  ('水果', '我喜欢吃水果。', 'Wǒ xǐhuān chī shuǐguǒ.', 'Tôi thích ăn trái cây.'),
  ('睡觉', '我晚上十点睡觉。', 'Wǒ wǎnshàng shí diǎn shuìjiào.', 'Tôi đi ngủ lúc mười giờ tối.'),
  ('说话', '我们一起说话。', 'Wǒmen yìqǐ shuōhuà.', 'Chúng ta cùng nhau nói chuyện.'),
  ('四', '我有四本书。', 'Wǒ yǒu sì běn shū.', 'Tôi có bốn quyển sách.'),
  ('岁', '我今年二十岁。', 'Wǒ jīnnián èrshí suì.', 'Năm nay tôi hai mươi tuổi.'),
  ('他', '他是我的朋友。', 'Tā shì wǒ de péngyǒu.', 'Anh ấy là bạn của tôi.'),
  ('她', '她是我的老师。', 'Tā shì wǒ de lǎoshī.', 'Cô ấy là giáo viên của tôi.'),
  ('太', '这个苹果太大了。', 'Zhè ge píngguǒ tài dà le.', 'Quả táo này quá to rồi.'),
  ('天气', '今天天气很好。', 'Jīntiān tiānqì hěn hǎo.', 'Hôm nay thời tiết rất tốt.'),
  ('听', '我喜欢听音乐。', 'Wǒ xǐhuān tīng yīnyuè.', 'Tôi thích nghe nhạc.'),
  ('同学', '他是我的同学。', 'Tā shì wǒ de tóngxué.', 'Anh ấy là bạn học của tôi.'),
  ('喂', '喂，你好！', 'Wèi, nǐ hǎo!', 'Alo, xin chào!'),
  ('我', '我喜欢学习中文。', 'Wǒ xǐhuān xuéxí Zhōngwén.', 'Tôi thích học tiếng Trung.'),
  ('我们', '我们去学校。', 'Wǒmen qù xuéxiào.', 'Chúng tôi đi đến trường.'),
  ('五', '我有五本书。', 'Wǒ yǒu wǔ běn shū.', 'Tôi có năm cuốn sách.'),
  ('喜欢', '我喜欢喝茶。', 'Wǒ xǐhuān hē chá.', 'Tôi thích uống trà.'),
  ('下', '他在桌子下。', 'Tā zài zhuōzi xià.', 'Anh ấy ở dưới bàn.'),
  ('下午', '我们下午去公园。', 'Wǒmen xiàwǔ qù gōngyuán.', 'Buổi chiều chúng tôi đi công viên.'),
  ('下雨', '今天下雨了。', 'Jīntiān xià yǔ le.', 'Hôm nay trời mưa rồi.'),
  ('先生', '王先生是我的老师。', 'Wáng xiānsheng shì wǒ de lǎoshī.', 'Thầy Vương là giáo viên của tôi.'),
  ('现在', '现在我在学校。', 'Xiànzài wǒ zài xuéxiào.', 'Bây giờ tôi đang ở trường.'),
  ('想', '我想吃苹果。', 'Wǒ xiǎng chī píngguǒ.', 'Tôi muốn ăn táo.'),
  ('小', '这个苹果很小。', 'Zhè ge píngguǒ hěn xiǎo.', 'Quả táo này rất nhỏ.'),
  ('小姐', '小姐，你好！', 'Xiǎojiě, nǐ hǎo!', 'Cô ơi, xin chào!'),
  ('些', '我有些苹果。', 'Wǒ yǒu xiē píngguǒ.', 'Tôi có một vài quả táo.'),
  ('写', '我喜欢写字。', 'Wǒ xǐhuān xiě zì.', 'Tôi thích viết chữ.'),
  ('谢谢', '谢谢你帮我。', 'Xièxie nǐ bāng wǒ.', 'Cảm ơn bạn đã giúp tôi.'),
  ('星期', '今天是星期三。', 'Jīntiān shì xīngqī sān.', 'Hôm nay là thứ Tư.'),
  ('学生', '学生在学校学习。', 'Xuésheng zài xuéxiào xuéxí.', 'Học sinh đang học ở trường.'),
  ('学习', '我每天学习中文。', 'Wǒ měitiān xuéxí Zhōngwén.', 'Tôi học tiếng Trung mỗi ngày.'),
  ('学校', '我去学校学习。', 'Wǒ qù xuéxiào xuéxí.', 'Tôi đến trường để học.'),
  ('一', '我有一只猫。', 'Wǒ yǒu yī zhī māo.', 'Tôi có một con mèo.'),
  ('一点儿', '我想喝一点儿水。', 'Wǒ xiǎng hē yìdiǎnr shuǐ.', 'Tôi muốn uống một chút nước.'),
  ('衣服', '我买了新衣服。', 'Wǒ mǎi le xīn yīfu.', 'Tôi đã mua quần áo mới.'),
  ('医生', '医生在医院工作。', 'Yīshēng zài yīyuàn gōngzuò.', 'Bác sĩ làm việc ở bệnh viện.'),
  ('医院', '我去医院看病。', 'Wǒ qù yīyuàn kàn bìng.', 'Tôi đi bệnh viện để khám bệnh.'),
  ('椅子', '这个椅子很舒服。', 'Zhè ge yǐzi hěn shūfu.', 'Cái ghế này rất thoải mái.'),
  ('有', '我有一本书。', 'Wǒ yǒu yī běn shū.', 'Tôi có một quyển sách.'),
  ('月', '这个月有三十天。', 'Zhège yuè yǒu sānshí tiān.', 'Tháng này có ba mươi ngày.'),
  ('在', '我在学校。', 'Wǒ zài xuéxiào.', 'Tôi đang ở trường.'),
  ('再见', '老师，再见！', 'Lǎoshī, zàijiàn!', 'Tạm biệt thầy cô!'),
  ('怎么', '你怎么去学校？', 'Nǐ zěnme qù xuéxiào?', 'Bạn đi học thế nào?'),
  ('怎么样', '你觉得怎么样？', 'Nǐ juéde zěnmeyàng?', 'Bạn cảm thấy như thế nào?'),
  ('这', '这是我的书。', 'Zhè shì wǒ de shū.', 'Đây là sách của tôi.'),
  ('中国', '我喜欢中国。', 'Wǒ xǐhuān Zhōngguó.', 'Tôi thích Trung Quốc.'),
  ('中午', '我们中午吃饭。', 'Wǒmen zhōngwǔ chīfàn.', 'Chúng tôi ăn cơm buổi trưa.'),
  ('住', '我住在北京。', 'Wǒ zhù zài Běijīng.', 'Tôi sống ở Bắc Kinh.'),
  ('桌子', '桌子上有一本书。', 'Zhuōzi shàng yǒu yī běn shū.', 'Trên cái bàn có một quyển sách.'),
  ('字', '这个字很简单。', 'Zhè ge zì hěn jiǎndān.', 'Chữ này rất đơn giản.'),
  ('昨天', '我昨天去学校。', 'Wǒ zuótiān qù xuéxiào.', 'Hôm qua tôi đi học.'),
  ('坐', '请坐在椅子上。', 'Qǐng zuò zài yǐzi shàng.', 'Mời ngồi trên ghế.'),
  ('做', '我每天做作业。', 'Wǒ měitiān zuò zuòyè.', 'Tôi làm bài tập mỗi ngày.');

update public.template_cards as card
set
  example_cn = coalesce(nullif(btrim(card.example_cn), ''), example.example_cn),
  example_pinyin = coalesce(nullif(btrim(card.example_pinyin), ''), example.example_pinyin),
  example_vi = coalesce(nullif(btrim(card.example_vi), ''), example.example_vi)
from public.template_decks as deck,
  hsk1_example_backfill as example
where card.template_deck_id = deck.id
  and deck.slug = 'hsk1-co-ban'
  and card.chinese = example.chinese
  and (
    nullif(btrim(card.example_cn), '') is null
    or nullif(btrim(card.example_pinyin), '') is null
    or nullif(btrim(card.example_vi), '') is null
  );

update public.cards as card
set
  example_cn = coalesce(nullif(btrim(card.example_cn), ''), example.example_cn),
  example_pinyin = coalesce(nullif(btrim(card.example_pinyin), ''), example.example_pinyin),
  example_vi = coalesce(nullif(btrim(card.example_vi), ''), example.example_vi)
from public.decks as deck,
  hsk1_example_backfill as example
where card.deck_id = deck.id
  and card.user_id = deck.user_id
  and (
    deck.source_template_slug = 'hsk1-co-ban'
    or (deck.source_template_slug is null and deck.name = 'HSK1 cơ bản')
  )
  and card.chinese = example.chinese
  and (
    nullif(btrim(card.example_cn), '') is null
    or nullif(btrim(card.example_pinyin), '') is null
    or nullif(btrim(card.example_vi), '') is null
  );

commit;
