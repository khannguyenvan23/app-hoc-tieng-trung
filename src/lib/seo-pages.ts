export type SeoPageContent = {
  path: string;
  navLabel: string;
  metaTitle: string;
  title: string;
  description: string;
  eyebrow: string;
  heroImage: string;
  heroImageAlt: string;
  keywords: readonly string[];
  highlights: readonly string[];
  sections: readonly {
    title: string;
    body: string;
  }[];
  stepsTitle: string;
  steps: readonly string[];
  faq: readonly {
    question: string;
    answer: string;
  }[];
  related: readonly {
    href: string;
    label: string;
  }[];
};

export const seoPages = {
  hsk1: {
    path: "/hsk1",
    navLabel: "HSK1",
    metaTitle: "Học HSK1 online với flashcard, audio và SRS",
    title: "Học HSK1 cho người mới bắt đầu",
    description:
      "Lộ trình học HSK1 bằng flashcard tiếng Trung, audio, pinyin, câu ví dụ và lịch ôn SRS để nhớ từ vựng lâu hơn.",
    eyebrow: "Từ vựng HSK1",
    heroImage: "/landing-flashcard.png",
    heroImageAlt: "Màn hình ôn tập từ vựng HSK1 trên Tiếng Trung Hihi",
    keywords: [
      "học HSK1",
      "từ vựng HSK1",
      "flashcard HSK1",
      "học tiếng Trung cho người mới",
    ],
    highlights: [
      "Bộ từ vựng nền tảng cho người mới học",
      "Mặt trước là nghĩa tiếng Việt để tự nhớ chữ Hán",
      "Audio, pinyin và câu ví dụ để học đúng ngữ cảnh",
      "SRS tự nhắc lại các từ dễ quên",
    ],
    sections: [
      {
        title: "Bắt đầu bằng nghĩa, sau đó nhớ chữ Hán",
        body: "Cách học trong app đặt nghĩa tiếng Việt ở mặt trước. Bạn tự đoán chữ Hán trước, rồi mới mở đáp án để xem chữ Trung, pinyin và câu ví dụ.",
      },
      {
        title: "Nghe phát âm ngay trong lúc ôn",
        body: "Mỗi thẻ có thể có audio từ vựng và câu ví dụ. Bạn có thể nghe bình thường hoặc chậm để nhận rõ thanh điệu.",
      },
      {
        title: "Ôn đúng thời điểm bằng SRS",
        body: "Sau mỗi lần học, bạn chọn Quên, Khó, Nhớ hoặc Dễ. App sẽ tự tính thời điểm lặp lại để giảm việc học lại quá nhiều.",
      },
    ],
    stepsTitle: "Cách học HSK1 mỗi ngày",
    steps: [
      "Thêm bộ HSK1 mẫu vào tài khoản của bạn.",
      "Học 10-20 từ mới mỗi ngày, không cần học dồn quá nhiều.",
      "Bật audio khi lật thẻ để gắn chữ Hán với phát âm.",
      "Cuối ngày chỉ ôn phần đến hạn, nhất là các từ đã bấm Quên.",
    ],
    faq: [
      {
        question: "Người mới học tiếng Trung có dùng được không?",
        answer:
          "Có. HSK1 phù hợp để bắt đầu với từ vựng cơ bản, nghĩa tiếng Việt, pinyin và ví dụ đơn giản.",
      },
      {
        question: "Có cần thuộc pinyin trước không?",
        answer:
          "Không bắt buộc. Bạn có thể ẩn pinyin lúc đầu và chỉ bật khi cần gợi ý để tránh phụ thuộc quá sớm.",
      },
      {
        question: "Học HSK1 trên app có mất credit không?",
        answer:
          "Ôn bộ thẻ đã có sẵn không tốn credit. Credit chủ yếu dùng khi bạn import bằng AI hoặc tạo audio mới.",
      },
    ],
    related: [
      { href: "/tu-vung-hsk1", label: "Từ vựng HSK1" },
      { href: "/hoc-tieng-trung-moi-ngay", label: "Học tiếng Trung mỗi ngày" },
      { href: "/hsk2", label: "Học tiếp HSK2" },
    ],
  },
  hsk2: {
    path: "/hsk2",
    navLabel: "HSK2",
    metaTitle: "Học HSK2 online với câu ví dụ, audio và SRS",
    title: "Học HSK2 sau khi đã có nền tảng HSK1",
    description:
      "Ôn từ vựng HSK2 bằng flashcard, câu ví dụ tiếng Trung, nghĩa tiếng Việt, audio và lịch lặp lại ngắt quãng.",
    eyebrow: "Từ vựng HSK2",
    heroImage: "/landing-study-sentences.png",
    heroImageAlt: "Màn hình luyện câu HSK2 trên Tiếng Trung Hihi",
    keywords: [
      "học HSK2",
      "từ vựng HSK2",
      "flashcard HSK2",
      "luyện câu tiếng Trung",
    ],
    highlights: [
      "Mở rộng vốn từ giao tiếp sau HSK1",
      "Học từ trong câu để hiểu cách dùng",
      "Tự nghe audio câu ví dụ khi mở đáp án",
      "Theo dõi thẻ yếu để ôn lại kịp thời",
    ],
    sections: [
      {
        title: "Học từ HSK2 theo ngữ cảnh",
        body: "Mỗi từ có thể đi kèm câu ví dụ để bạn không chỉ biết nghĩa rời rạc mà còn thấy cách dùng trong câu thật.",
      },
      {
        title: "Luyện câu song song với flashcard",
        body: "Ngoài ôn từ, app có chế độ luyện câu: mặt trước là nghĩa tiếng Việt, mặt sau là câu tiếng Trung kèm pinyin, audio và từ vựng trong câu.",
      },
      {
        title: "Giữ tiến độ học ổn định",
        body: "Bạn có thể đặt nhịp học vừa sức, tập trung vào số thẻ đến hạn và nhóm từ yếu thay vì học lan man.",
      },
    ],
    stepsTitle: "Cách học HSK2 hiệu quả",
    steps: [
      "Ôn lại các từ HSK1 còn yếu trước khi thêm nhiều từ HSK2.",
      "Học từ mới theo từng nhóm nhỏ, ưu tiên từ thường gặp.",
      "Đọc câu ví dụ thành tiếng và nghe lại audio.",
      "Dùng nút Quên/Khó/Nhớ/Dễ thật trung thực để SRS xếp lịch đúng.",
    ],
    faq: [
      {
        question: "Nên học HSK2 khi nào?",
        answer:
          "Khi bạn đã quen phần cơ bản của HSK1 và có thể nhận ra các câu đơn giản, HSK2 là bước tiếp theo hợp lý.",
      },
      {
        question: "HSK2 có cần luyện câu không?",
        answer:
          "Rất nên. HSK2 có nhiều từ dễ nhớ nghĩa nhưng khó dùng đúng, nên học trong câu sẽ hiệu quả hơn.",
      },
      {
        question: "Có thể tự import thêm từ HSK2 riêng không?",
        answer:
          "Có. Bạn có thể dán danh sách từ, app sẽ dùng AI tạo nghĩa, pinyin, câu ví dụ và audio nếu còn credit.",
      },
    ],
    related: [
      { href: "/hsk1", label: "Học HSK1" },
      { href: "/hoc-tieng-trung-moi-ngay", label: "Lộ trình mỗi ngày" },
      { href: "/pricing", label: "Bảng giá credit" },
    ],
  },
  hsk1Vocabulary: {
    path: "/tu-vung-hsk1",
    navLabel: "Từ vựng HSK1",
    metaTitle: "Từ vựng HSK1: cách học nhanh nhớ lâu bằng flashcard",
    title: "Cách học từ vựng HSK1 nhanh nhớ lâu",
    description:
      "Hướng dẫn học từ vựng HSK1 bằng nghĩa tiếng Việt, chữ Hán, pinyin, câu ví dụ, audio và ôn lặp lại ngắt quãng.",
    eyebrow: "Học từ vựng",
    heroImage: "/landing-flashcard.png",
    heroImageAlt: "Flashcard từ vựng HSK1 có chữ Hán, pinyin và audio",
    keywords: [
      "từ vựng HSK1",
      "học từ vựng tiếng Trung",
      "flashcard tiếng Trung",
      "pinyin HSK1",
    ],
    highlights: [
      "Chia từ mới thành nhóm nhỏ dễ học",
      "Ẩn pinyin để nhớ chữ Hán chủ động hơn",
      "Có câu ví dụ để phân biệt cách dùng",
      "Nhóm thẻ yếu giúp biết từ nào cần học lại",
    ],
    sections: [
      {
        title: "Đừng học từ vựng như danh sách dài",
        body: "Một danh sách dài rất dễ tạo cảm giác đã học nhưng nhanh quên. Flashcard giúp bạn kiểm tra trí nhớ thật ở từng lần lật thẻ.",
      },
      {
        title: "Ưu tiên nghĩa và chữ Hán trước",
        body: "Khi mặt trước là nghĩa tiếng Việt, bạn phải tự nhớ chữ Hán. Pinyin nên dùng như gợi ý thay vì nhìn ngay từ đầu.",
      },
      {
        title: "Học lại từ sai nhiều lần",
        body: "Các từ bấm Quên nhiều lần sẽ được đưa vào nhóm cần học lại, giúp bạn xử lý đúng điểm yếu thay vì ôn đều mọi thứ.",
      },
    ],
    stepsTitle: "Quy trình học một từ HSK1",
    steps: [
      "Nhìn nghĩa tiếng Việt và tự nhớ chữ Hán.",
      "Mở đáp án để kiểm tra chữ Trung, pinyin và nghĩa.",
      "Nghe audio từ vựng hoặc câu ví dụ.",
      "Chọn mức Quên, Khó, Nhớ, Dễ để app xếp lịch ôn.",
    ],
    faq: [
      {
        question: "Có nên bật pinyin liên tục không?",
        answer:
          "Nếu mới bắt đầu, pinyin rất hữu ích. Nhưng khi đã quen, bạn nên tắt pinyin và chỉ bật khi cần gợi ý.",
      },
      {
        question: "Mỗi ngày nên học bao nhiêu từ HSK1?",
        answer:
          "Người mới thường nên bắt đầu 10-20 từ mỗi ngày. Quan trọng hơn là duy trì ôn lại các từ đến hạn.",
      },
      {
        question: "Có thể sửa thẻ sau khi import không?",
        answer:
          "Có. Bạn có thể chỉnh chữ Hán, pinyin, nghĩa, câu ví dụ và audio để bộ thẻ đúng theo cách học của mình.",
      },
    ],
    related: [
      { href: "/hsk1", label: "Lộ trình HSK1" },
      { href: "/hsk2", label: "Lộ trình HSK2" },
      { href: "/pricing", label: "Credit AI" },
    ],
  },
  dailyChinese: {
    path: "/hoc-tieng-trung-moi-ngay",
    navLabel: "Học mỗi ngày",
    metaTitle: "Học tiếng Trung mỗi ngày với flashcard, audio và SRS",
    title: "Học tiếng Trung mỗi ngày mà không bị quá tải",
    description:
      "Xây thói quen học tiếng Trung mỗi ngày bằng thẻ đến hạn, từ mới vừa sức, audio, luyện câu và SRS.",
    eyebrow: "Lộ trình tự học",
    heroImage: "/landing-study-sentences.png",
    heroImageAlt: "Màn hình luyện câu tiếng Trung mỗi ngày",
    keywords: [
      "học tiếng Trung mỗi ngày",
      "tự học tiếng Trung",
      "lộ trình học tiếng Trung",
      "SRS tiếng Trung",
    ],
    highlights: [
      "Biết hôm nay cần ôn gì ngay khi mở app",
      "Không học dồn quá nhiều từ mới một lúc",
      "Audio giúp luyện nghe và phát âm đều đặn",
      "Thống kê giúp giữ streak học mỗi ngày",
    ],
    sections: [
      {
        title: "Học ít nhưng đều",
        body: "Thay vì học thật nhiều trong một ngày rồi bỏ quên, app ưu tiên lượng từ mới vừa sức và các thẻ đã đến hạn.",
      },
      {
        title: "Tách từ vựng và luyện câu",
        body: "Bạn có thể ôn từ riêng, rồi luyện câu riêng để biến từ đã học thành khả năng hiểu câu thực tế.",
      },
      {
        title: "Theo dõi tiến độ rõ ràng",
        body: "Dashboard hiển thị tổng thẻ, thẻ cần ôn, thẻ mới import, streak và nhóm cần học lại để bạn biết nên làm gì tiếp theo.",
      },
    ],
    stepsTitle: "Một buổi học gợi ý",
    steps: [
      "Mở app và ôn hết phần thẻ đến hạn.",
      "Thêm một lượng từ mới vừa sức nếu còn thời gian.",
      "Nghe lại audio các câu khó hoặc từ dễ nhầm.",
      "Kết thúc bằng nhóm cần học lại để khóa điểm yếu.",
    ],
    faq: [
      {
        question: "Mỗi ngày cần học bao lâu?",
        answer:
          "Bạn có thể bắt đầu với 10-15 phút. Điều quan trọng là đều đặn và ôn đúng thẻ đến hạn.",
      },
      {
        question: "Nếu nghỉ vài ngày thì sao?",
        answer:
          "Các thẻ đến hạn vẫn còn đó. Khi quay lại, bạn chỉ cần ôn phần tồn đọng và giảm lượng từ mới trong vài ngày.",
      },
      {
        question: "App phù hợp với người học để thi HSK không?",
        answer:
          "Có. App phù hợp để xây vốn từ HSK1/HSK2, luyện nghe phát âm và duy trì lịch ôn từ vựng.",
      },
    ],
    related: [
      { href: "/hsk1", label: "Bắt đầu HSK1" },
      { href: "/tu-vung-hsk1", label: "Cách học từ HSK1" },
      { href: "/hsk2", label: "Học tiếp HSK2" },
    ],
  },
} satisfies Record<string, SeoPageContent>;

export const seoPageList = Object.values(seoPages);
