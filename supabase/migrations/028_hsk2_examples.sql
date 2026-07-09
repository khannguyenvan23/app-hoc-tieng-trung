-- Add HSK2 examples without overwriting content edited by users.
-- Uses a single CTE statement so it works in Supabase SQL Editor and migration runners
-- that do not preserve temporary tables across statements.
with hsk2_example_backfill (
  chinese,
  example_cn,
  example_pinyin,
  example_vi
) as (
  values
  ('吧', '我们一起去吃饭吧。', 'Wǒmen yìqǐ qù chīfàn ba.', 'Chúng ta cùng đi ăn cơm nhé.'),
  ('白', '我喜欢穿白色的衣服。', 'Wǒ xǐhuan chuān báisè de yīfu.', 'Tôi thích mặc quần áo màu trắng.'),
  ('百', '这本书有一百页。', 'Zhè běn shū yǒu yì bǎi yè.', 'Cuốn sách này có một trăm trang.'),
  ('帮助', '谢谢你帮助我学习中文。', 'Xièxie nǐ bāngzhù wǒ xuéxí Zhōngwén.', 'Cảm ơn bạn đã giúp tôi học tiếng Trung.'),
  ('报纸', '爸爸每天早上看报纸。', 'Bàba měitiān zǎoshang kàn bàozhǐ.', 'Bố đọc báo giấy mỗi sáng.'),
  ('比', '今天比昨天热。', 'Jīntiān bǐ zuótiān rè.', 'Hôm nay nóng hơn hôm qua.'),
  ('别', '别在教室里说话。', 'Bié zài jiàoshì lǐ shuōhuà.', 'Đừng nói chuyện trong lớp học.'),
  ('宾馆', '我们住在火车站旁边的宾馆。', 'Wǒmen zhù zài huǒchēzhàn pángbiān de bīnguǎn.', 'Chúng tôi ở khách sạn bên cạnh ga tàu.'),
  ('长', '这条路很长。', 'Zhè tiáo lù hěn cháng.', 'Con đường này rất dài.'),
  ('唱歌', '妹妹喜欢唱歌。', 'Mèimei xǐhuan chànggē.', 'Em gái thích hát.'),
  ('出', '他从房间里出来了。', 'Tā cóng fángjiān lǐ chūlái le.', 'Anh ấy đi ra khỏi phòng.'),
  ('穿', '今天很冷，你多穿一点。', 'Jīntiān hěn lěng, nǐ duō chuān yìdiǎn.', 'Hôm nay lạnh, bạn mặc thêm một chút đi.'),
  ('船', '我们坐船去那个城市。', 'Wǒmen zuò chuán qù nà ge chéngshì.', 'Chúng tôi đi thuyền đến thành phố đó.'),
  ('次', '我去过北京三次。', 'Wǒ qùguo Běijīng sān cì.', 'Tôi đã đến Bắc Kinh ba lần.'),
  ('从', '我从学校回家。', 'Wǒ cóng xuéxiào huí jiā.', 'Tôi từ trường về nhà.'),
  ('错', '这个答案错了。', 'Zhè ge dáàn cuò le.', 'Đáp án này sai rồi.'),
  ('打篮球', '他们下午在学校打篮球。', 'Tāmen xiàwǔ zài xuéxiào dǎ lánqiú.', 'Chiều nay họ chơi bóng rổ ở trường.'),
  ('大家', '大家都喜欢这个老师。', 'Dàjiā dōu xǐhuan zhè ge lǎoshī.', 'Mọi người đều thích giáo viên này.'),
  ('到', '我八点到公司。', 'Wǒ bā diǎn dào gōngsī.', 'Tôi đến công ty lúc tám giờ.'),
  ('得', '他说中文说得很好。', 'Tā shuō Zhōngwén shuō de hěn hǎo.', 'Anh ấy nói tiếng Trung rất tốt.'),
  ('等', '请等我一下。', 'Qǐng děng wǒ yíxià.', 'Hãy đợi tôi một chút.'),
  ('弟弟', '我弟弟今年十岁。', 'Wǒ dìdi jīnnián shí suì.', 'Em trai tôi năm nay mười tuổi.'),
  ('第一', '她是我们班第一。', 'Tā shì wǒmen bān dì yī.', 'Cô ấy đứng thứ nhất trong lớp chúng tôi.'),
  ('懂', '我懂你的意思。', 'Wǒ dǒng nǐ de yìsi.', 'Tôi hiểu ý của bạn.'),
  ('对', '你说得对。', 'Nǐ shuō de duì.', 'Bạn nói đúng.'),
  ('房间', '这个房间很干净。', 'Zhè ge fángjiān hěn gānjìng.', 'Căn phòng này rất sạch sẽ.'),
  ('非常', '今天的天气非常好。', 'Jīntiān de tiānqì fēicháng hǎo.', 'Thời tiết hôm nay rất tốt.'),
  ('服务员', '服务员给我们拿菜单。', 'Fúwùyuán gěi wǒmen ná càidān.', 'Nhân viên phục vụ mang thực đơn cho chúng tôi.'),
  ('高', '哥哥比我高。', 'Gēge bǐ wǒ gāo.', 'Anh trai cao hơn tôi.'),
  ('告诉', '请告诉我你的名字。', 'Qǐng gàosu wǒ nǐ de míngzi.', 'Hãy nói cho tôi biết tên của bạn.'),
  ('哥哥', '我哥哥在医院工作。', 'Wǒ gēge zài yīyuàn gōngzuò.', 'Anh trai tôi làm việc ở bệnh viện.'),
  ('给', '妈妈给我买了一件衣服。', 'Māma gěi wǒ mǎi le yí jiàn yīfu.', 'Mẹ mua cho tôi một bộ quần áo.'),
  ('公共汽车', '我每天坐公共汽车上班。', 'Wǒ měitiān zuò gōnggòng qìchē shàngbān.', 'Tôi đi xe buýt đi làm mỗi ngày.'),
  ('公司', '这家公司很大。', 'Zhè jiā gōngsī hěn dà.', 'Công ty này rất lớn.'),
  ('贵', '这件衣服太贵了。', 'Zhè jiàn yīfu tài guì le.', 'Bộ quần áo này quá đắt.'),
  ('过', '我看过这个电影。', 'Wǒ kànguo zhè ge diànyǐng.', 'Tôi đã xem bộ phim này rồi.'),
  ('还', '他还在教室里。', 'Tā hái zài jiàoshì lǐ.', 'Anh ấy vẫn còn ở trong lớp học.'),
  ('孩子', '这个孩子很可爱。', 'Zhè ge háizi hěn kěài.', 'Đứa trẻ này rất đáng yêu.'),
  ('好吃', '这家饭馆的面条很好吃。', 'Zhè jiā fànguǎn de miàntiáo hěn hǎochī.', 'Mì ở nhà hàng này rất ngon.'),
  ('黑', '他穿着一件黑衣服。', 'Tā chuānzhe yí jiàn hēi yīfu.', 'Anh ấy đang mặc một bộ quần áo màu đen.'),
  ('红', '我买了一个红苹果。', 'Wǒ mǎi le yí ge hóng píngguǒ.', 'Tôi đã mua một quả táo đỏ.'),
  ('火车站', '火车站离这里不远。', 'Huǒchēzhàn lí zhèlǐ bù yuǎn.', 'Ga tàu không xa nơi này.'),
  ('机场', '我们明天去机场接朋友。', 'Wǒmen míngtiān qù jīchǎng jiē péngyou.', 'Ngày mai chúng tôi ra sân bay đón bạn.'),
  ('鸡蛋', '我早饭吃了两个鸡蛋。', 'Wǒ zǎofàn chī le liǎng ge jīdàn.', 'Bữa sáng tôi ăn hai quả trứng gà.'),
  ('件', '我想买一件新衣服。', 'Wǒ xiǎng mǎi yí jiàn xīn yīfu.', 'Tôi muốn mua một bộ quần áo mới.'),
  ('教室', '学生们在教室里上课。', 'Xuéshengmen zài jiàoshì lǐ shàngkè.', 'Học sinh đang học trong lớp.'),
  ('姐姐', '姐姐正在看书。', 'Jiějie zhèngzài kàn shū.', 'Chị gái đang đọc sách.'),
  ('介绍', '我来介绍一下我的朋友。', 'Wǒ lái jièshào yíxià wǒ de péngyou.', 'Tôi xin giới thiệu bạn của tôi một chút.'),
  ('进', '请进房间。', 'Qǐng jìn fángjiān.', 'Mời vào phòng.'),
  ('近', '学校离我家很近。', 'Xuéxiào lí wǒ jiā hěn jìn.', 'Trường học rất gần nhà tôi.'),
  ('就', '我马上就来。', 'Wǒ mǎshàng jiù lái.', 'Tôi sẽ đến ngay.'),
  ('觉得', '我觉得中文很有意思。', 'Wǒ juéde Zhōngwén hěn yǒu yìsi.', 'Tôi thấy tiếng Trung rất thú vị.'),
  ('咖啡', '早上我喝一杯咖啡。', 'Zǎoshang wǒ hē yì bēi kāfēi.', 'Buổi sáng tôi uống một cốc cà phê.'),
  ('开始', '电影八点开始。', 'Diànyǐng bā diǎn kāishǐ.', 'Bộ phim bắt đầu lúc tám giờ.'),
  ('考试', '明天我们有中文考试。', 'Míngtiān wǒmen yǒu Zhōngwén kǎoshì.', 'Ngày mai chúng tôi có bài thi tiếng Trung.'),
  ('可能', '他今天可能不来。', 'Tā jīntiān kěnéng bù lái.', 'Hôm nay anh ấy có thể không đến.'),
  ('可以', '我可以坐这里吗？', 'Wǒ kěyǐ zuò zhèlǐ ma?', 'Tôi có thể ngồi ở đây không?'),
  ('课', '今天下午有三节课。', 'Jīntiān xiàwǔ yǒu sān jié kè.', 'Chiều nay có ba tiết học.'),
  ('快', '火车快到了。', 'Huǒchē kuài dào le.', 'Tàu hỏa sắp đến rồi.'),
  ('快乐', '祝你生日快乐。', 'Zhù nǐ shēngrì kuàilè.', 'Chúc bạn sinh nhật vui vẻ.'),
  ('累', '我今天工作很累。', 'Wǒ jīntiān gōngzuò hěn lèi.', 'Hôm nay tôi làm việc rất mệt.'),
  ('离', '我家离公司很远。', 'Wǒ jiā lí gōngsī hěn yuǎn.', 'Nhà tôi cách công ty rất xa.'),
  ('两', '我有两个姐姐。', 'Wǒ yǒu liǎng ge jiějie.', 'Tôi có hai chị gái.'),
  ('零', '我的电话号码里有两个零。', 'Wǒ de diànhuà hàomǎ lǐ yǒu liǎng ge líng.', 'Trong số điện thoại của tôi có hai số không.'),
  ('路', '这条路很宽。', 'Zhè tiáo lù hěn kuān.', 'Con đường này rất rộng.'),
  ('旅游', '我们去年去中国旅游。', 'Wǒmen qùnián qù Zhōngguó lǚyóu.', 'Năm ngoái chúng tôi đi du lịch Trung Quốc.'),
  ('卖', '这家商店卖水果。', 'Zhè jiā shāngdiàn mài shuǐguǒ.', 'Cửa hàng này bán trái cây.'),
  ('慢', '请你说慢一点。', 'Qǐng nǐ shuō màn yìdiǎn.', 'Bạn nói chậm một chút nhé.'),
  ('忙', '爸爸今天很忙。', 'Bàba jīntiān hěn máng.', 'Hôm nay bố rất bận.'),
  ('每', '我每天学习一个小时。', 'Wǒ měitiān xuéxí yí ge xiǎoshí.', 'Mỗi ngày tôi học một tiếng.'),
  ('妹妹', '妹妹喜欢吃西瓜。', 'Mèimei xǐhuan chī xīguā.', 'Em gái thích ăn dưa hấu.'),
  ('门', '请把门关上。', 'Qǐng bǎ mén guānshang.', 'Hãy đóng cửa lại.'),
  ('面条', '我中午吃面条。', 'Wǒ zhōngwǔ chī miàntiáo.', 'Buổi trưa tôi ăn mì.'),
  ('男', '那个男学生是我同学。', 'Nà ge nán xuésheng shì wǒ tóngxué.', 'Nam sinh kia là bạn học của tôi.'),
  ('您', '您想喝茶还是咖啡？', 'Nín xiǎng hē chá háishi kāfēi?', 'Ngài muốn uống trà hay cà phê?'),
  ('牛奶', '孩子每天喝牛奶。', 'Háizi měitiān hē niúnǎi.', 'Trẻ con uống sữa bò mỗi ngày.'),
  ('女', '那位女老师很年轻。', 'Nà wèi nǚ lǎoshī hěn niánqīng.', 'Cô giáo kia rất trẻ.'),
  ('旁边', '银行在学校旁边。', 'Yínháng zài xuéxiào pángbiān.', 'Ngân hàng ở bên cạnh trường học.'),
  ('跑步', '我每天早上跑步。', 'Wǒ měitiān zǎoshang pǎobù.', 'Tôi chạy bộ mỗi sáng.'),
  ('便宜', '这个手机不贵，很便宜。', 'Zhè ge shǒujī bú guì, hěn piányi.', 'Chiếc điện thoại này không đắt, rất rẻ.'),
  ('票', '我买了两张电影票。', 'Wǒ mǎi le liǎng zhāng diànyǐng piào.', 'Tôi đã mua hai vé xem phim.'),
  ('妻子', '他的妻子是医生。', 'Tā de qīzi shì yīshēng.', 'Vợ của anh ấy là bác sĩ.'),
  ('起床', '我每天七点起床。', 'Wǒ měitiān qī diǎn qǐchuáng.', 'Tôi thức dậy lúc bảy giờ mỗi ngày.'),
  ('千', '这台电脑三千块钱。', 'Zhè tái diànnǎo sān qiān kuài qián.', 'Chiếc máy tính này ba nghìn tệ.'),
  ('晴', '今天是晴天。', 'Jīntiān shì qíngtiān.', 'Hôm nay là ngày nắng.'),
  ('去年', '去年我在北京学习。', 'Qùnián wǒ zài Běijīng xuéxí.', 'Năm ngoái tôi học ở Bắc Kinh.'),
  ('让', '老师让我回答问题。', 'Lǎoshī ràng wǒ huídá wèntí.', 'Giáo viên bảo tôi trả lời câu hỏi.'),
  ('日', '今天是九月一日。', 'Jīntiān shì jiǔ yuè yī rì.', 'Hôm nay là ngày một tháng chín.'),
  ('上班', '妈妈每天坐地铁上班。', 'Māma měitiān zuò dìtiě shàngbān.', 'Mẹ đi tàu điện ngầm đi làm mỗi ngày.'),
  ('身体', '运动对身体很好。', 'Yùndòng duì shēntǐ hěn hǎo.', 'Vận động rất tốt cho cơ thể.'),
  ('生病', '他生病了，今天不去上班。', 'Tā shēngbìng le, jīntiān bú qù shàngbān.', 'Anh ấy bị bệnh nên hôm nay không đi làm.'),
  ('生日', '今天是我的生日。', 'Jīntiān shì wǒ de shēngrì.', 'Hôm nay là sinh nhật của tôi.'),
  ('时间', '你有时间喝咖啡吗？', 'Nǐ yǒu shíjiān hē kāfēi ma?', 'Bạn có thời gian uống cà phê không?'),
  ('事情', '我有一件重要的事情。', 'Wǒ yǒu yí jiàn zhòngyào de shìqing.', 'Tôi có một việc quan trọng.'),
  ('手表', '这块手表很漂亮。', 'Zhè kuài shǒubiǎo hěn piàoliang.', 'Chiếc đồng hồ đeo tay này rất đẹp.'),
  ('手机', '我的手机在桌子上。', 'Wǒ de shǒujī zài zhuōzi shàng.', 'Điện thoại của tôi ở trên bàn.'),
  ('说话', '请不要大声说话。', 'Qǐng bú yào dàshēng shuōhuà.', 'Xin đừng nói chuyện lớn tiếng.'),
  ('送', '我送你一本书。', 'Wǒ sòng nǐ yì běn shū.', 'Tôi tặng bạn một cuốn sách.'),
  ('虽然', '虽然很累，我还想学习。', 'Suīrán hěn lèi, wǒ hái xiǎng xuéxí.', 'Tuy rất mệt, tôi vẫn muốn học.'),
  ('但是', '我喜欢这件衣服，但是太贵了。', 'Wǒ xǐhuan zhè jiàn yīfu, dànshì tài guì le.', 'Tôi thích bộ quần áo này, nhưng nó quá đắt.'),
  ('它', '这只狗很小，它很可爱。', 'Zhè zhī gǒu hěn xiǎo, tā hěn kěài.', 'Con chó này rất nhỏ, nó rất đáng yêu.'),
  ('踢足球', '哥哥周末喜欢踢足球。', 'Gēge zhōumò xǐhuan tī zúqiú.', 'Cuối tuần anh trai thích đá bóng.'),
  ('题', '这道题很难。', 'Zhè dào tí hěn nán.', 'Câu hỏi này rất khó.'),
  ('跳舞', '姐姐跳舞跳得很好。', 'Jiějie tiàowǔ tiào de hěn hǎo.', 'Chị gái nhảy múa rất giỏi.'),
  ('外', '外面下雪了。', 'Wàimiàn xià xuě le.', 'Bên ngoài tuyết rơi rồi.'),
  ('完', '我做完作业了。', 'Wǒ zuò wán zuòyè le.', 'Tôi làm xong bài tập rồi.'),
  ('玩', '孩子们在外面玩。', 'Háizimen zài wàimiàn wán.', 'Bọn trẻ đang chơi ở bên ngoài.'),
  ('晚上', '晚上我们一起看电影。', 'Wǎnshang wǒmen yìqǐ kàn diànyǐng.', 'Buổi tối chúng ta cùng xem phim.'),
  ('为什么', '你为什么学习中文？', 'Nǐ wèishénme xuéxí Zhōngwén?', 'Tại sao bạn học tiếng Trung?'),
  ('问', '我想问你一个问题。', 'Wǒ xiǎng wèn nǐ yí ge wèntí.', 'Tôi muốn hỏi bạn một câu hỏi.'),
  ('问题', '这个问题不太难。', 'Zhè ge wèntí bú tài nán.', 'Vấn đề này không quá khó.'),
  ('西瓜', '夏天吃西瓜很舒服。', 'Xiàtiān chī xīguā hěn shūfu.', 'Mùa hè ăn dưa hấu rất dễ chịu.'),
  ('希望', '我希望明天天气好。', 'Wǒ xīwàng míngtiān tiānqì hǎo.', 'Tôi hy vọng ngày mai thời tiết tốt.'),
  ('洗', '吃饭前要洗手。', 'Chīfàn qián yào xǐ shǒu.', 'Trước khi ăn phải rửa tay.'),
  ('小时', '我每天学习两个小时。', 'Wǒ měitiān xuéxí liǎng ge xiǎoshí.', 'Tôi học hai tiếng mỗi ngày.'),
  ('笑', '她一笑就很好看。', 'Tā yí xiào jiù hěn hǎokàn.', 'Cô ấy cười lên thì rất đẹp.'),
  ('新', '我买了一部新手机。', 'Wǒ mǎi le yí bù xīn shǒujī.', 'Tôi đã mua một chiếc điện thoại mới.'),
  ('姓', '请问您姓什么？', 'Qǐngwèn nín xìng shénme?', 'Xin hỏi ngài họ gì?'),
  ('休息', '累了就休息一下。', 'Lèi le jiù xiūxi yíxià.', 'Mệt rồi thì nghỉ một chút.'),
  ('雪', '孩子们喜欢看雪。', 'Háizimen xǐhuan kàn xuě.', 'Bọn trẻ thích ngắm tuyết.'),
  ('颜色', '你喜欢什么颜色？', 'Nǐ xǐhuan shénme yánsè?', 'Bạn thích màu gì?'),
  ('眼睛', '她的眼睛很大。', 'Tā de yǎnjing hěn dà.', 'Mắt của cô ấy rất to.'),
  ('羊肉', '我不太喜欢吃羊肉。', 'Wǒ bú tài xǐhuan chī yángròu.', 'Tôi không thích ăn thịt cừu lắm.'),
  ('药', '生病了要吃药。', 'Shēngbìng le yào chī yào.', 'Bị bệnh thì phải uống thuốc.'),
  ('要', '我要一杯热茶。', 'Wǒ yào yì bēi rè chá.', 'Tôi muốn một cốc trà nóng.'),
  ('也', '我也喜欢跑步。', 'Wǒ yě xǐhuan pǎobù.', 'Tôi cũng thích chạy bộ.'),
  ('已经', '我已经吃过饭了。', 'Wǒ yǐjīng chīguo fàn le.', 'Tôi đã ăn cơm rồi.'),
  ('一起', '我们一起去图书馆吧。', 'Wǒmen yìqǐ qù túshūguǎn ba.', 'Chúng ta cùng đi thư viện nhé.'),
  ('一下', '请你看一下这个字。', 'Qǐng nǐ kàn yíxià zhè ge zì.', 'Bạn xem chữ này một chút nhé.'),
  ('意思', '这个词是什么意思？', 'Zhè ge cí shì shénme yìsi?', 'Từ này có nghĩa là gì?'),
  ('因为', '因为下雨，所以我没去跑步。', 'Yīnwèi xià yǔ, suǒyǐ wǒ méi qù pǎobù.', 'Vì trời mưa nên tôi không đi chạy bộ.'),
  ('所以', '我今天很忙，所以不能去。', 'Wǒ jīntiān hěn máng, suǒyǐ bù néng qù.', 'Hôm nay tôi rất bận nên không thể đi.'),
  ('阴', '今天是阴天。', 'Jīntiān shì yīntiān.', 'Hôm nay trời âm u.'),
  ('游泳', '夏天我常常去游泳。', 'Xiàtiān wǒ chángcháng qù yóuyǒng.', 'Mùa hè tôi thường đi bơi.'),
  ('右边', '书店在银行右边。', 'Shūdiàn zài yínháng yòubiān.', 'Hiệu sách ở bên phải ngân hàng.'),
  ('鱼', '这条鱼很好吃。', 'Zhè tiáo yú hěn hǎochī.', 'Con cá này rất ngon.'),
  ('远', '机场离市中心很远。', 'Jīchǎng lí shì zhōngxīn hěn yuǎn.', 'Sân bay rất xa trung tâm thành phố.'),
  ('运动', '运动让身体更健康。', 'Yùndòng ràng shēntǐ gèng jiànkāng.', 'Vận động làm cơ thể khỏe mạnh hơn.'),
  ('再', '请你再说一次。', 'Qǐng nǐ zài shuō yí cì.', 'Bạn nói lại một lần nữa nhé.'),
  ('早上', '早上我喜欢喝牛奶。', 'Zǎoshang wǒ xǐhuan hē niúnǎi.', 'Buổi sáng tôi thích uống sữa.'),
  ('丈夫', '她的丈夫在公司上班。', 'Tā de zhàngfu zài gōngsī shàngbān.', 'Chồng của cô ấy đi làm ở công ty.'),
  ('找', '我在找我的手表。', 'Wǒ zài zhǎo wǒ de shǒubiǎo.', 'Tôi đang tìm đồng hồ đeo tay của tôi.'),
  ('着', '门开着呢。', 'Mén kāizhe ne.', 'Cửa đang mở.'),
  ('真', '这件事情真有意思。', 'Zhè jiàn shìqing zhēn yǒu yìsi.', 'Việc này thật thú vị.'),
  ('正在', '他正在给朋友打电话。', 'Tā zhèngzài gěi péngyou dǎ diànhuà.', 'Anh ấy đang gọi điện cho bạn.'),
  ('知道', '我知道这个地方。', 'Wǒ zhīdào zhè ge dìfang.', 'Tôi biết nơi này.'),
  ('准备', '我正在准备考试。', 'Wǒ zhèngzài zhǔnbèi kǎoshì.', 'Tôi đang chuẩn bị cho kỳ thi.'),
  ('走', '我们走路去学校。', 'Wǒmen zǒulù qù xuéxiào.', 'Chúng tôi đi bộ đến trường.'),
  ('最', '这是我最喜欢的颜色。', 'Zhè shì wǒ zuì xǐhuan de yánsè.', 'Đây là màu tôi thích nhất.'),
  ('左边', '咖啡店在学校左边。', 'Kāfēidiàn zài xuéxiào zuǒbiān.', 'Quán cà phê ở bên trái trường học.')
),
updated_template_cards as (
  update public.template_cards as card
  set
    example_cn = coalesce(nullif(btrim(card.example_cn), ''), example.example_cn),
    example_pinyin = coalesce(nullif(btrim(card.example_pinyin), ''), example.example_pinyin),
    example_vi = coalesce(nullif(btrim(card.example_vi), ''), example.example_vi)
  from public.template_decks as deck,
    hsk2_example_backfill as example
  where card.template_deck_id = deck.id
    and deck.slug = 'hsk2-co-ban'
    and card.chinese = example.chinese
    and (
      nullif(btrim(card.example_cn), '') is null
      or nullif(btrim(card.example_pinyin), '') is null
      or nullif(btrim(card.example_vi), '') is null
    )
  returning card.id
)
update public.cards as card
set
  example_cn = coalesce(nullif(btrim(card.example_cn), ''), example.example_cn),
  example_pinyin = coalesce(nullif(btrim(card.example_pinyin), ''), example.example_pinyin),
  example_vi = coalesce(nullif(btrim(card.example_vi), ''), example.example_vi)
from public.decks as deck,
  hsk2_example_backfill as example
where card.deck_id = deck.id
  and card.user_id = deck.user_id
  and (
    deck.source_template_slug = 'hsk2-co-ban'
    or (deck.source_template_slug is null and deck.name = 'HSK2 cơ bản')
  )
  and card.chinese = example.chinese
  and (
    nullif(btrim(card.example_cn), '') is null
    or nullif(btrim(card.example_pinyin), '') is null
    or nullif(btrim(card.example_vi), '') is null
  );
