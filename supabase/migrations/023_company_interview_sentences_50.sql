insert into public.template_decks (slug, name, description, level)
values (
  'phong-van-cong-ty-50',
  '50 câu phỏng vấn công ty',
  'Bộ 50 câu tiếng Trung thường gặp khi phỏng vấn công ty, giới thiệu bản thân, kinh nghiệm, kỹ năng và hỏi về công việc.',
  'Luyện câu'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = 'phong-van-cong-ty-50'
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
    ('请先做一下自我介绍。', 'Qǐng xiān zuò yíxià zìwǒ jièshào.', 'Xin hãy giới thiệu bản thân trước.', '[{"chinese":"自我介绍","pinyin":"zìwǒ jièshào","meaning_vi":"giới thiệu bản thân"},{"chinese":"请","pinyin":"qǐng","meaning_vi":"xin, mời"}]', 1),
    ('我叫阮文强，来自越南。', 'Wǒ jiào Ruǎn Wénqiáng, láizì Yuènán.', 'Tôi tên là Nguyễn Văn Cường, đến từ Việt Nam.', '[{"chinese":"来自","pinyin":"láizì","meaning_vi":"đến từ"},{"chinese":"越南","pinyin":"Yuènán","meaning_vi":"Việt Nam"}]', 2),
    ('我毕业于河内大学。', 'Wǒ bìyè yú Hénèi Dàxué.', 'Tôi tốt nghiệp Đại học Hà Nội.', '[{"chinese":"毕业","pinyin":"bìyè","meaning_vi":"tốt nghiệp"},{"chinese":"大学","pinyin":"dàxué","meaning_vi":"đại học"}]', 3),
    ('我的专业是市场营销。', 'Wǒ de zhuānyè shì shìchǎng yíngxiāo.', 'Chuyên ngành của tôi là marketing.', '[{"chinese":"专业","pinyin":"zhuānyè","meaning_vi":"chuyên ngành"},{"chinese":"市场营销","pinyin":"shìchǎng yíngxiāo","meaning_vi":"marketing"}]', 4),
    ('我有三年的工作经验。', 'Wǒ yǒu sān nián de gōngzuò jīngyàn.', 'Tôi có ba năm kinh nghiệm làm việc.', '[{"chinese":"工作经验","pinyin":"gōngzuò jīngyàn","meaning_vi":"kinh nghiệm làm việc"},{"chinese":"三年","pinyin":"sān nián","meaning_vi":"ba năm"}]', 5),
    ('我以前在一家贸易公司工作。', 'Wǒ yǐqián zài yì jiā màoyì gōngsī gōngzuò.', 'Trước đây tôi làm việc tại một công ty thương mại.', '[{"chinese":"以前","pinyin":"yǐqián","meaning_vi":"trước đây"},{"chinese":"贸易公司","pinyin":"màoyì gōngsī","meaning_vi":"công ty thương mại"}]', 6),
    ('我主要负责客户沟通和订单跟进。', 'Wǒ zhǔyào fùzé kèhù gōutōng hé dìngdān gēnjìn.', 'Tôi chủ yếu phụ trách giao tiếp khách hàng và theo dõi đơn hàng.', '[{"chinese":"负责","pinyin":"fùzé","meaning_vi":"phụ trách"},{"chinese":"客户","pinyin":"kèhù","meaning_vi":"khách hàng"},{"chinese":"订单","pinyin":"dìngdān","meaning_vi":"đơn hàng"}]', 7),
    ('我熟悉办公软件。', 'Wǒ shúxī bàngōng ruǎnjiàn.', 'Tôi quen sử dụng phần mềm văn phòng.', '[{"chinese":"熟悉","pinyin":"shúxī","meaning_vi":"quen thuộc, thành thạo"},{"chinese":"办公软件","pinyin":"bàngōng ruǎnjiàn","meaning_vi":"phần mềm văn phòng"}]', 8),
    ('我的中文水平可以满足工作需要。', 'Wǒ de Zhōngwén shuǐpíng kěyǐ mǎnzú gōngzuò xūyào.', 'Trình độ tiếng Trung của tôi có thể đáp ứng nhu cầu công việc.', '[{"chinese":"水平","pinyin":"shuǐpíng","meaning_vi":"trình độ"},{"chinese":"满足","pinyin":"mǎnzú","meaning_vi":"đáp ứng"},{"chinese":"需要","pinyin":"xūyào","meaning_vi":"nhu cầu"}]', 9),
    ('我能用中文和客户交流。', 'Wǒ néng yòng Zhōngwén hé kèhù jiāoliú.', 'Tôi có thể dùng tiếng Trung để giao tiếp với khách hàng.', '[{"chinese":"交流","pinyin":"jiāoliú","meaning_vi":"trao đổi, giao tiếp"},{"chinese":"客户","pinyin":"kèhù","meaning_vi":"khách hàng"}]', 10),
    ('你为什么想加入我们公司？', 'Nǐ wèishénme xiǎng jiārù wǒmen gōngsī?', 'Vì sao bạn muốn gia nhập công ty chúng tôi?', '[{"chinese":"加入","pinyin":"jiārù","meaning_vi":"gia nhập"},{"chinese":"公司","pinyin":"gōngsī","meaning_vi":"công ty"}]', 11),
    ('我很认可贵公司的发展方向。', 'Wǒ hěn rènkě guì gōngsī de fāzhǎn fāngxiàng.', 'Tôi rất công nhận định hướng phát triển của quý công ty.', '[{"chinese":"认可","pinyin":"rènkě","meaning_vi":"công nhận"},{"chinese":"发展方向","pinyin":"fāzhǎn fāngxiàng","meaning_vi":"định hướng phát triển"}]', 12),
    ('我希望在这里长期发展。', 'Wǒ xīwàng zài zhèlǐ chángqī fāzhǎn.', 'Tôi hy vọng phát triển lâu dài ở đây.', '[{"chinese":"希望","pinyin":"xīwàng","meaning_vi":"hy vọng"},{"chinese":"长期","pinyin":"chángqī","meaning_vi":"lâu dài"}]', 13),
    ('你的优点是什么？', 'Nǐ de yōudiǎn shì shénme?', 'Ưu điểm của bạn là gì?', '[{"chinese":"优点","pinyin":"yōudiǎn","meaning_vi":"ưu điểm"}]', 14),
    ('我的优点是学习能力强，做事认真。', 'Wǒ de yōudiǎn shì xuéxí nénglì qiáng, zuòshì rènzhēn.', 'Ưu điểm của tôi là khả năng học hỏi tốt và làm việc nghiêm túc.', '[{"chinese":"学习能力","pinyin":"xuéxí nénglì","meaning_vi":"khả năng học hỏi"},{"chinese":"认真","pinyin":"rènzhēn","meaning_vi":"nghiêm túc"}]', 15),
    ('你的缺点是什么？', 'Nǐ de quēdiǎn shì shénme?', 'Khuyết điểm của bạn là gì?', '[{"chinese":"缺点","pinyin":"quēdiǎn","meaning_vi":"khuyết điểm"}]', 16),
    ('我的缺点是有时候太追求细节。', 'Wǒ de quēdiǎn shì yǒu shíhou tài zhuīqiú xìjié.', 'Khuyết điểm của tôi là đôi khi quá theo đuổi chi tiết.', '[{"chinese":"追求","pinyin":"zhuīqiú","meaning_vi":"theo đuổi"},{"chinese":"细节","pinyin":"xìjié","meaning_vi":"chi tiết"}]', 17),
    ('你能承受工作压力吗？', 'Nǐ néng chéngshòu gōngzuò yālì ma?', 'Bạn có thể chịu được áp lực công việc không?', '[{"chinese":"承受","pinyin":"chéngshòu","meaning_vi":"chịu đựng"},{"chinese":"压力","pinyin":"yālì","meaning_vi":"áp lực"}]', 18),
    ('我可以承受压力，并按时完成任务。', 'Wǒ kěyǐ chéngshòu yālì, bìng ànshí wánchéng rènwu.', 'Tôi có thể chịu áp lực và hoàn thành nhiệm vụ đúng hạn.', '[{"chinese":"按时","pinyin":"ànshí","meaning_vi":"đúng hạn"},{"chinese":"完成任务","pinyin":"wánchéng rènwu","meaning_vi":"hoàn thành nhiệm vụ"}]', 19),
    ('你喜欢团队合作还是独立工作？', 'Nǐ xǐhuan tuánduì hézuò háishi dúlì gōngzuò?', 'Bạn thích làm việc nhóm hay làm việc độc lập?', '[{"chinese":"团队合作","pinyin":"tuánduì hézuò","meaning_vi":"làm việc nhóm"},{"chinese":"独立工作","pinyin":"dúlì gōngzuò","meaning_vi":"làm việc độc lập"}]', 20),
    ('我喜欢团队合作，也能独立完成工作。', 'Wǒ xǐhuan tuánduì hézuò, yě néng dúlì wánchéng gōngzuò.', 'Tôi thích làm việc nhóm, cũng có thể hoàn thành công việc độc lập.', '[{"chinese":"团队合作","pinyin":"tuánduì hézuò","meaning_vi":"làm việc nhóm"},{"chinese":"独立","pinyin":"dúlì","meaning_vi":"độc lập"}]', 21),
    ('你如何处理客户投诉？', 'Nǐ rúhé chǔlǐ kèhù tóusù?', 'Bạn xử lý khiếu nại của khách hàng như thế nào?', '[{"chinese":"处理","pinyin":"chǔlǐ","meaning_vi":"xử lý"},{"chinese":"投诉","pinyin":"tóusù","meaning_vi":"khiếu nại"}]', 22),
    ('我会先倾听客户的问题，再提出解决方案。', 'Wǒ huì xiān qīngtīng kèhù de wèntí, zài tíchū jiějué fāng''àn.', 'Tôi sẽ lắng nghe vấn đề của khách hàng trước, sau đó đưa ra phương án giải quyết.', '[{"chinese":"倾听","pinyin":"qīngtīng","meaning_vi":"lắng nghe"},{"chinese":"解决方案","pinyin":"jiějué fāng''àn","meaning_vi":"phương án giải quyết"}]', 23),
    ('你对加班有什么看法？', 'Nǐ duì jiābān yǒu shénme kànfǎ?', 'Bạn có quan điểm gì về việc tăng ca?', '[{"chinese":"加班","pinyin":"jiābān","meaning_vi":"tăng ca"},{"chinese":"看法","pinyin":"kànfǎ","meaning_vi":"quan điểm"}]', 24),
    ('如果工作需要，我可以配合加班。', 'Rúguǒ gōngzuò xūyào, wǒ kěyǐ pèihé jiābān.', 'Nếu công việc cần, tôi có thể phối hợp tăng ca.', '[{"chinese":"配合","pinyin":"pèihé","meaning_vi":"phối hợp"},{"chinese":"加班","pinyin":"jiābān","meaning_vi":"tăng ca"}]', 25),
    ('你期望的薪资是多少？', 'Nǐ qīwàng de xīnzī shì duōshao?', 'Mức lương bạn kỳ vọng là bao nhiêu?', '[{"chinese":"期望","pinyin":"qīwàng","meaning_vi":"kỳ vọng"},{"chinese":"薪资","pinyin":"xīnzī","meaning_vi":"lương"}]', 26),
    ('我希望薪资能符合我的经验和能力。', 'Wǒ xīwàng xīnzī néng fúhé wǒ de jīngyàn hé nénglì.', 'Tôi hy vọng mức lương phù hợp với kinh nghiệm và năng lực của tôi.', '[{"chinese":"符合","pinyin":"fúhé","meaning_vi":"phù hợp"},{"chinese":"能力","pinyin":"nénglì","meaning_vi":"năng lực"}]', 27),
    ('你什么时候可以开始上班？', 'Nǐ shénme shíhou kěyǐ kāishǐ shàngbān?', 'Khi nào bạn có thể bắt đầu đi làm?', '[{"chinese":"开始","pinyin":"kāishǐ","meaning_vi":"bắt đầu"},{"chinese":"上班","pinyin":"shàngbān","meaning_vi":"đi làm"}]', 28),
    ('如果被录用，我下周就可以上班。', 'Rúguǒ bèi lùyòng, wǒ xià zhōu jiù kěyǐ shàngbān.', 'Nếu được tuyển dụng, tuần sau tôi có thể đi làm.', '[{"chinese":"录用","pinyin":"lùyòng","meaning_vi":"tuyển dụng"},{"chinese":"下周","pinyin":"xià zhōu","meaning_vi":"tuần sau"}]', 29),
    ('你为什么离开上一家公司？', 'Nǐ wèishénme líkāi shàng yì jiā gōngsī?', 'Vì sao bạn rời công ty trước?', '[{"chinese":"离开","pinyin":"líkāi","meaning_vi":"rời khỏi"},{"chinese":"上一家公司","pinyin":"shàng yì jiā gōngsī","meaning_vi":"công ty trước"}]', 30),
    ('我想寻找更大的发展空间。', 'Wǒ xiǎng xúnzhǎo gèng dà de fāzhǎn kōngjiān.', 'Tôi muốn tìm kiếm không gian phát triển lớn hơn.', '[{"chinese":"寻找","pinyin":"xúnzhǎo","meaning_vi":"tìm kiếm"},{"chinese":"发展空间","pinyin":"fāzhǎn kōngjiān","meaning_vi":"không gian phát triển"}]', 31),
    ('你了解我们公司的产品吗？', 'Nǐ liǎojiě wǒmen gōngsī de chǎnpǐn ma?', 'Bạn có hiểu sản phẩm của công ty chúng tôi không?', '[{"chinese":"了解","pinyin":"liǎojiě","meaning_vi":"hiểu, tìm hiểu"},{"chinese":"产品","pinyin":"chǎnpǐn","meaning_vi":"sản phẩm"}]', 32),
    ('我在面试前已经了解了贵公司的产品。', 'Wǒ zài miànshì qián yǐjīng liǎojiě le guì gōngsī de chǎnpǐn.', 'Trước buổi phỏng vấn tôi đã tìm hiểu sản phẩm của quý công ty.', '[{"chinese":"面试","pinyin":"miànshì","meaning_vi":"phỏng vấn"},{"chinese":"产品","pinyin":"chǎnpǐn","meaning_vi":"sản phẩm"}]', 33),
    ('你未来三年的职业规划是什么？', 'Nǐ wèilái sān nián de zhíyè guīhuà shì shénme?', 'Kế hoạch nghề nghiệp trong ba năm tới của bạn là gì?', '[{"chinese":"未来","pinyin":"wèilái","meaning_vi":"tương lai"},{"chinese":"职业规划","pinyin":"zhíyè guīhuà","meaning_vi":"kế hoạch nghề nghiệp"}]', 34),
    ('我希望提升专业能力，成为团队骨干。', 'Wǒ xīwàng tíshēng zhuānyè nénglì, chéngwéi tuánduì gǔgàn.', 'Tôi hy vọng nâng cao năng lực chuyên môn và trở thành nòng cốt của nhóm.', '[{"chinese":"提升","pinyin":"tíshēng","meaning_vi":"nâng cao"},{"chinese":"团队骨干","pinyin":"tuánduì gǔgàn","meaning_vi":"nòng cốt nhóm"}]', 35),
    ('你有什么成功的项目经验？', 'Nǐ yǒu shénme chénggōng de xiàngmù jīngyàn?', 'Bạn có kinh nghiệm dự án thành công nào?', '[{"chinese":"成功","pinyin":"chénggōng","meaning_vi":"thành công"},{"chinese":"项目经验","pinyin":"xiàngmù jīngyàn","meaning_vi":"kinh nghiệm dự án"}]', 36),
    ('我曾经参与一个销售增长项目。', 'Wǒ céngjīng cānyù yí ge xiāoshòu zēngzhǎng xiàngmù.', 'Tôi từng tham gia một dự án tăng trưởng doanh số.', '[{"chinese":"参与","pinyin":"cānyù","meaning_vi":"tham gia"},{"chinese":"销售增长","pinyin":"xiāoshòu zēngzhǎng","meaning_vi":"tăng trưởng doanh số"}]', 37),
    ('这个项目让销售额提高了百分之二十。', 'Zhège xiàngmù ràng xiāoshòu''é tígāo le bǎi fēn zhī èrshí.', 'Dự án này giúp doanh số tăng hai mươi phần trăm.', '[{"chinese":"销售额","pinyin":"xiāoshòu''é","meaning_vi":"doanh số"},{"chinese":"提高","pinyin":"tígāo","meaning_vi":"tăng, nâng cao"}]', 38),
    ('你遇到困难时会怎么做？', 'Nǐ yùdào kùnnan shí huì zěnme zuò?', 'Khi gặp khó khăn bạn sẽ làm thế nào?', '[{"chinese":"遇到","pinyin":"yùdào","meaning_vi":"gặp phải"},{"chinese":"困难","pinyin":"kùnnan","meaning_vi":"khó khăn"}]', 39),
    ('我会分析原因，并主动寻求帮助。', 'Wǒ huì fēnxī yuányīn, bìng zhǔdòng xúnqiú bāngzhù.', 'Tôi sẽ phân tích nguyên nhân và chủ động tìm kiếm sự giúp đỡ.', '[{"chinese":"分析","pinyin":"fēnxī","meaning_vi":"phân tích"},{"chinese":"主动","pinyin":"zhǔdòng","meaning_vi":"chủ động"}]', 40),
    ('你会使用哪些工作工具？', 'Nǐ huì shǐyòng nǎxiē gōngzuò gōngjù?', 'Bạn biết sử dụng những công cụ làm việc nào?', '[{"chinese":"使用","pinyin":"shǐyòng","meaning_vi":"sử dụng"},{"chinese":"工具","pinyin":"gōngjù","meaning_vi":"công cụ"}]', 41),
    ('我会使用Excel、邮件和项目管理工具。', 'Wǒ huì shǐyòng Excel, yóujiàn hé xiàngmù guǎnlǐ gōngjù.', 'Tôi biết dùng Excel, email và công cụ quản lý dự án.', '[{"chinese":"邮件","pinyin":"yóujiàn","meaning_vi":"email"},{"chinese":"项目管理","pinyin":"xiàngmù guǎnlǐ","meaning_vi":"quản lý dự án"}]', 42),
    ('你能接受出差吗？', 'Nǐ néng jiēshòu chūchāi ma?', 'Bạn có thể chấp nhận đi công tác không?', '[{"chinese":"接受","pinyin":"jiēshòu","meaning_vi":"chấp nhận"},{"chinese":"出差","pinyin":"chūchāi","meaning_vi":"đi công tác"}]', 43),
    ('如果公司需要，我可以出差。', 'Rúguǒ gōngsī xūyào, wǒ kěyǐ chūchāi.', 'Nếu công ty cần, tôi có thể đi công tác.', '[{"chinese":"公司","pinyin":"gōngsī","meaning_vi":"công ty"},{"chinese":"出差","pinyin":"chūchāi","meaning_vi":"đi công tác"}]', 44),
    ('你对这个岗位有什么理解？', 'Nǐ duì zhège gǎngwèi yǒu shénme lǐjiě?', 'Bạn hiểu gì về vị trí này?', '[{"chinese":"岗位","pinyin":"gǎngwèi","meaning_vi":"vị trí công việc"},{"chinese":"理解","pinyin":"lǐjiě","meaning_vi":"hiểu"}]', 45),
    ('我认为这个岗位需要沟通能力和执行力。', 'Wǒ rènwéi zhège gǎngwèi xūyào gōutōng nénglì hé zhíxínglì.', 'Tôi cho rằng vị trí này cần khả năng giao tiếp và năng lực thực thi.', '[{"chinese":"沟通能力","pinyin":"gōutōng nénglì","meaning_vi":"khả năng giao tiếp"},{"chinese":"执行力","pinyin":"zhíxínglì","meaning_vi":"năng lực thực thi"}]', 46),
    ('你还有什么问题想问我们吗？', 'Nǐ hái yǒu shénme wèntí xiǎng wèn wǒmen ma?', 'Bạn còn câu hỏi nào muốn hỏi chúng tôi không?', '[{"chinese":"问题","pinyin":"wèntí","meaning_vi":"câu hỏi, vấn đề"},{"chinese":"想问","pinyin":"xiǎng wèn","meaning_vi":"muốn hỏi"}]', 47),
    ('请问这个岗位的主要目标是什么？', 'Qǐngwèn zhège gǎngwèi de zhǔyào mùbiāo shì shénme?', 'Xin hỏi mục tiêu chính của vị trí này là gì?', '[{"chinese":"主要目标","pinyin":"zhǔyào mùbiāo","meaning_vi":"mục tiêu chính"},{"chinese":"岗位","pinyin":"gǎngwèi","meaning_vi":"vị trí"}]', 48),
    ('请问公司会提供培训吗？', 'Qǐngwèn gōngsī huì tígōng péixùn ma?', 'Xin hỏi công ty có cung cấp đào tạo không?', '[{"chinese":"提供","pinyin":"tígōng","meaning_vi":"cung cấp"},{"chinese":"培训","pinyin":"péixùn","meaning_vi":"đào tạo"}]', 49),
    ('非常感谢您给我这次面试机会。', 'Fēicháng gǎnxiè nín gěi wǒ zhè cì miànshì jīhuì.', 'Rất cảm ơn ngài đã cho tôi cơ hội phỏng vấn lần này.', '[{"chinese":"感谢","pinyin":"gǎnxiè","meaning_vi":"cảm ơn"},{"chinese":"面试机会","pinyin":"miànshì jīhuì","meaning_vi":"cơ hội phỏng vấn"}]', 50)
) as card(sentence_cn, sentence_pinyin, sentence_vi, vocab_json, position)
on conflict (template_deck_id, sentence_cn) do update
set
  sentence_pinyin = excluded.sentence_pinyin,
  sentence_vi = excluded.sentence_vi,
  vocab_json = excluded.vocab_json,
  position = excluded.position;
