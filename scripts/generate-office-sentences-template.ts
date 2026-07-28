import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import OpenAI from "openai";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateTemplateSpeech } from "@/lib/tts";

loadEnvConfig(process.cwd());

type CategorySpec = {
  id: string;
  name: string;
  count: number;
  scope: string;
  requiredSituations: string[];
};

type HighlightWord = {
  chinese: string;
  pinyin: string;
  meaning_vi: string;
};

type GeneratedSentence = {
  category: string;
  sentence_cn: string;
  sentence_pinyin: string;
  sentence_vi: string;
  vocabulary: HighlightWord[];
};

type OfficeSentenceCard = GeneratedSentence & {
  position: number;
  sentenceAudioUrl: string;
};

const isFactoryTemplate = process.argv.includes("--factory");
const isFriendshipTemplate = process.argv.includes("--friendship");
const isChinaDailyLifeTemplate = process.argv.includes("--china-daily-life");
const isTravelAirportTemplate = process.argv.includes("--travel-airport");
const isSalesCustomerServiceTemplate = process.argv.includes(
  "--sales-customer-service",
);
const isLogisticsImportExportTemplate = process.argv.includes(
  "--logistics-import-export",
);
const isCommercialContractNegotiationTemplate = process.argv.includes(
  "--commercial-contract-negotiation",
);
const isWorkCallsMessagesTemplate = process.argv.includes(
  "--work-calls-messages",
);
const templateSlug = isFactoryTemplate
  ? "nha-may-xuong-150-cau"
  : isFriendshipTemplate
    ? "lam-quen-ket-ban-150-cau"
    : isChinaDailyLifeTemplate
      ? "sinh-hoat-tai-trung-quoc-200-cau"
      : isTravelAirportTemplate
        ? "du-lich-san-bay-150-cau"
        : isSalesCustomerServiceTemplate
          ? "ban-hang-cham-soc-khach-hang-150-cau"
          : isLogisticsImportExportTemplate
            ? "xuat-nhap-khau-logistics-150-cau"
            : isCommercialContractNegotiationTemplate
              ? "thuong-mai-hop-dong-dam-phan-150-cau"
              : isWorkCallsMessagesTemplate
                ? "dien-thoai-nhan-tin-cong-viec-100-cau"
                : "giao-tiep-cong-so-150-cau";
const outputPath = isFactoryTemplate
  ? "supabase/migrations/044_factory_150_sentences.sql"
  : isFriendshipTemplate
    ? "supabase/migrations/045_friendship_150_sentences.sql"
    : isChinaDailyLifeTemplate
      ? "supabase/migrations/046_china_daily_life_200_sentences.sql"
      : isTravelAirportTemplate
        ? "supabase/migrations/047_travel_airport_150_sentences.sql"
        : isSalesCustomerServiceTemplate
          ? "supabase/migrations/048_sales_customer_service_150_sentences.sql"
          : isLogisticsImportExportTemplate
            ? "supabase/migrations/050_logistics_import_export_150_sentences.sql"
            : isCommercialContractNegotiationTemplate
              ? "supabase/migrations/053_commercial_contract_negotiation_150_sentences.sql"
              : isWorkCallsMessagesTemplate
                ? "supabase/migrations/054_work_calls_messages_100_sentences.sql"
                : "supabase/migrations/043_office_communication_150_sentences.sql";
const cachePath = path.join(
  os.tmpdir(),
  isFactoryTemplate
    ? "tiengtrunghihi-factory-150-sentences.json"
    : isFriendshipTemplate
      ? "tiengtrunghihi-friendship-150-sentences.json"
      : isChinaDailyLifeTemplate
        ? "tiengtrunghihi-china-daily-life-200-sentences.json"
        : isTravelAirportTemplate
          ? "tiengtrunghihi-travel-airport-150-sentences.json"
          : isSalesCustomerServiceTemplate
            ? "tiengtrunghihi-sales-customer-service-150-sentences.json"
            : isLogisticsImportExportTemplate
              ? "tiengtrunghihi-logistics-import-export-150-sentences.json"
              : isCommercialContractNegotiationTemplate
                ? "tiengtrunghihi-commercial-contract-negotiation-150-sentences.json"
                : isWorkCallsMessagesTemplate
                  ? "tiengtrunghihi-work-calls-messages-100-sentences.json"
                  : "tiengtrunghihi-office-communication-150-sentences.json",
);
const expectedTotal = isChinaDailyLifeTemplate
  ? 200
  : isWorkCallsMessagesTemplate
    ? 100
    : 150;
const maxHighlightWords =
  isChinaDailyLifeTemplate ||
  isTravelAirportTemplate ||
  isSalesCustomerServiceTemplate ||
  isLogisticsImportExportTemplate ||
  isCommercialContractNegotiationTemplate ||
  isWorkCallsMessagesTemplate
    ? 2
    : 3;
const audioConcurrency = 3;
const execFileAsync = promisify(execFile);
let useEdgeTtsOnly = false;
const templateName = isFactoryTemplate
  ? "Nhà máy/xưởng - 150 câu"
  : isFriendshipTemplate
    ? "Làm quen và kết bạn - 150 câu"
    : isChinaDailyLifeTemplate
      ? "Sinh hoạt tại Trung Quốc - 200 câu"
      : isTravelAirportTemplate
        ? "Du lịch và sân bay - 150 câu"
        : isSalesCustomerServiceTemplate
          ? "Bán hàng và chăm sóc khách hàng - 150 câu"
          : isLogisticsImportExportTemplate
            ? "Xuất nhập khẩu và logistics - 150 câu"
            : isCommercialContractNegotiationTemplate
              ? "Thương mại, hợp đồng và đàm phán - 150 câu"
              : isWorkCallsMessagesTemplate
                ? "Điện thoại và nhắn tin công việc - 100 câu"
                : "Giao tiếp công sở - 150 câu";
const templateDescription = isFactoryTemplate
  ? "150 câu tiếng Trung theo tình huống nhà máy và xưởng sản xuất: giao ca, vận hành máy, kiểm tra chất lượng, báo lỗi, bảo trì, an toàn lao động và phối hợp sản xuất. Mỗi câu có pinyin, nghĩa tiếng Việt, từ mới được highlight và audio tạo sẵn."
  : isFriendshipTemplate
    ? "150 câu tiếng Trung tự nhiên để làm quen và kết bạn: chào hỏi, giới thiệu bản thân, hỏi quê quán và nghề nghiệp, chia sẻ sở thích, xin WeChat, rủ đi chơi và hẹn gặp lại. Mỗi câu có pinyin, nghĩa tiếng Việt, từ mới được highlight và audio tạo sẵn."
    : isChinaDailyLifeTemplate
      ? "200 câu tiếng Trung HSK1-HSK3 dùng trong sinh hoạt tại Trung Quốc: thuê nhà, điện nước, sửa chữa, giao hàng, hỏi đường, đi lại, WeChat, thanh toán và xử lý vấn đề hằng ngày. Mỗi câu có pinyin, nghĩa tiếng Việt, 1-2 từ mới được highlight và audio tạo sẵn."
      : isTravelAirportTemplate
        ? "150 câu tiếng Trung thực tế cho hành trình du lịch và sân bay: làm thủ tục, nhập cảnh, hành lý, phương tiện, khách sạn và tình huống khẩn cấp. Mỗi câu có pinyin, nghĩa tiếng Việt, 1-2 từ mới được highlight và audio tạo sẵn."
        : isSalesCustomerServiceTemplate
          ? "150 câu tiếng Trung thực tế cho bán hàng và chăm sóc khách hàng: tìm hiểu nhu cầu, tư vấn sản phẩm, báo giá, thương lượng, chốt đơn, phản hồi sau bán và xử lý khiếu nại. Mỗi câu có pinyin, nghĩa tiếng Việt, 1-2 từ mới được highlight và audio tạo sẵn."
          : isLogisticsImportExportTemplate
            ? "150 câu tiếng Trung thực tế cho xuất nhập khẩu và logistics: tìm nguồn hàng, hợp đồng, Incoterms, thanh toán, chứng từ, hải quan, kho bãi, vận tải, giao nhận và xử lý sự cố. Mỗi câu có pinyin, nghĩa tiếng Việt, 1-2 từ mới được highlight và audio tạo sẵn."
            : isCommercialContractNegotiationTemplate
              ? "150 câu tiếng Trung thực tế cho thương mại, hợp đồng và đàm phán: báo giá, chiết khấu, điều khoản, ký kết, thanh toán, công nợ, đại lý, hậu mãi và xử lý tranh chấp. Mỗi câu có pinyin, nghĩa tiếng Việt, 1-2 từ mới được highlight và audio tạo sẵn."
              : isWorkCallsMessagesTemplate
                ? "100 câu tiếng Trung thực tế để gọi điện và nhắn tin trong công việc: mở đầu cuộc gọi, chuyển máy, để lại lời nhắn, hẹn gọi lại, xác nhận thông tin, nhắn WeChat và xử lý liên lạc gián đoạn. Mỗi câu có pinyin, nghĩa tiếng Việt, 1-2 từ mới được highlight và audio tạo sẵn."
                : "150 câu tiếng Trung theo tình huống công sở: trao đổi công việc, giao nhiệm vụ, báo tiến độ, họp, xin nghỉ và nhắn tin với đồng nghiệp. Mỗi câu có pinyin, nghĩa tiếng Việt, từ mới được highlight và audio tạo sẵn.";

const officeCategories: CategorySpec[] = [
  {
    id: "daily-communication",
    name: "Giao tiếp hằng ngày tại văn phòng",
    count: 25,
    scope:
      "Chào hỏi, bắt đầu ngày làm việc, trao đổi nhanh, nhờ hỗ trợ, bàn giao tài liệu, xác nhận đã nhận thông tin và kết thúc ngày làm việc.",
    requiredSituations: [
      "chào đồng nghiệp",
      "hỏi lịch hôm nay",
      "nhờ hỗ trợ",
      "mượn tài liệu",
      "gửi tập tin",
      "xác nhận đã nhận",
      "bàn giao công việc",
      "trao đổi trực tiếp",
      "giờ nghỉ trưa",
      "tan làm",
    ],
  },
  {
    id: "tasks-deadlines",
    name: "Giao việc, kế hoạch và thời hạn",
    count: 25,
    scope:
      "Nhận nhiệm vụ, làm rõ yêu cầu, chia nhỏ công việc, phân công trách nhiệm, đặt ưu tiên, lập kế hoạch và thống nhất thời hạn.",
    requiredSituations: [
      "giao nhiệm vụ mới",
      "làm rõ yêu cầu",
      "người phụ trách",
      "mức độ ưu tiên",
      "thời hạn hoàn thành",
      "điều chỉnh kế hoạch",
      "phân chia công việc",
      "ước tính thời gian",
      "xác nhận phạm vi",
      "xin thêm thời gian",
    ],
  },
  {
    id: "progress-problems",
    name: "Báo tiến độ và xử lý vấn đề",
    count: 25,
    scope:
      "Báo cáo phần đã hoàn thành, việc còn lại, chậm tiến độ, nguyên nhân, rủi ro, lỗi phát sinh, phương án xử lý và đề nghị hỗ trợ.",
    requiredSituations: [
      "báo tiến độ",
      "đã hoàn thành",
      "đang xử lý",
      "chậm tiến độ",
      "gặp trở ngại",
      "phát hiện lỗi",
      "đánh giá rủi ro",
      "đề xuất phương án",
      "cần hỗ trợ",
      "thông báo kết quả",
    ],
  },
  {
    id: "meetings-decisions",
    name: "Họp, thuyết trình và ra quyết định",
    count: 25,
    scope:
      "Mời họp, xác nhận thời gian, trình bày ý kiến, đặt câu hỏi, đồng ý hoặc phản biện lịch sự, ghi biên bản, phân công sau họp và chốt quyết định.",
    requiredSituations: [
      "mời họp",
      "đổi lịch họp",
      "chương trình họp",
      "bắt đầu trình bày",
      "nêu quan điểm",
      "đặt câu hỏi",
      "đồng ý",
      "ý kiến khác",
      "kết luận cuộc họp",
      "biên bản họp",
    ],
  },
  {
    id: "attendance-leave",
    name: "Chấm công, xin nghỉ và công tác",
    count: 25,
    scope:
      "Đi muộn, về sớm, xin nghỉ phép hoặc nghỉ ốm, làm thêm giờ, làm việc từ xa, đổi ca, đi công tác và bàn giao khi vắng mặt.",
    requiredSituations: [
      "xin nghỉ phép",
      "nghỉ ốm",
      "đi muộn",
      "về sớm",
      "làm thêm giờ",
      "đổi ca",
      "làm việc từ xa",
      "đi công tác",
      "chấm công",
      "bàn giao khi nghỉ",
    ],
  },
  {
    id: "messages-collaboration",
    name: "Email, nhắn tin và phối hợp đồng nghiệp",
    count: 25,
    scope:
      "Soạn email, nhắn tin nhóm, gửi tệp đính kèm, nhắc phản hồi, thêm người liên quan, phối hợp liên phòng ban, phản hồi góp ý và theo dõi việc cần làm.",
    requiredSituations: [
      "tiêu đề email",
      "tệp đính kèm",
      "gửi nhầm người",
      "nhắc phản hồi",
      "nhóm chat công việc",
      "đánh dấu người liên quan",
      "phối hợp liên phòng ban",
      "phản hồi góp ý",
      "cập nhật tài liệu",
      "xác nhận bằng văn bản",
    ],
  },
];

const factoryCategories: CategorySpec[] = [
  {
    id: "shift-handover",
    name: "Giao ca và tiếp nhận công việc",
    count: 25,
    scope:
      "Điểm danh đầu ca, bàn giao sản lượng, tình trạng máy, nguyên liệu, đơn hàng, dụng cụ, vấn đề tồn đọng và xác nhận người tiếp nhận.",
    requiredSituations: [
      "điểm danh đầu ca",
      "bàn giao ca",
      "kiểm tra nhật ký sản xuất",
      "báo sản lượng ca trước",
      "bàn giao tình trạng máy",
      "bàn giao nguyên liệu",
      "bàn giao dụng cụ",
      "thông báo việc tồn đọng",
      "xác nhận người tiếp nhận",
      "kết thúc ca",
    ],
  },
  {
    id: "machine-operation",
    name: "Vận hành máy và dây chuyền",
    count: 25,
    scope:
      "Khởi động, dừng máy, cài đặt thông số, cấp nguyên liệu, thay khuôn, điều chỉnh tốc độ, quan sát bảng điều khiển, vệ sinh và tuân thủ quy trình vận hành.",
    requiredSituations: [
      "kiểm tra trước khi khởi động",
      "khởi động máy",
      "dừng máy đúng quy trình",
      "cài đặt thông số",
      "điều chỉnh tốc độ",
      "cấp nguyên liệu",
      "thay khuôn",
      "theo dõi bảng điều khiển",
      "vệ sinh thiết bị",
      "ghi chép dữ liệu vận hành",
    ],
  },
  {
    id: "quality-inspection",
    name: "Kiểm tra chất lượng sản phẩm",
    count: 25,
    scope:
      "Lấy mẫu, đo kích thước, kiểm tra ngoại quan, đối chiếu tiêu chuẩn, phân loại đạt hoặc không đạt, cách ly hàng lỗi, ghi phiếu và xác nhận chất lượng.",
    requiredSituations: [
      "lấy mẫu kiểm tra",
      "đo kích thước",
      "kiểm tra ngoại quan",
      "đối chiếu tiêu chuẩn",
      "phát hiện sai lệch",
      "phân loại sản phẩm",
      "cách ly hàng lỗi",
      "ghi phiếu kiểm tra",
      "kiểm tra lại",
      "xác nhận xuất hàng",
    ],
  },
  {
    id: "faults-maintenance",
    name: "Báo lỗi, xử lý sự cố và bảo trì",
    count: 25,
    scope:
      "Nhận biết tiếng động, nhiệt độ hoặc rung bất thường, dừng máy khẩn cấp, báo kỹ thuật, mô tả lỗi, khoanh vùng nguyên nhân, sửa chữa, thay linh kiện và chạy thử.",
    requiredSituations: [
      "phát hiện tiếng động lạ",
      "nhiệt độ bất thường",
      "máy rung mạnh",
      "dừng máy khẩn cấp",
      "báo nhân viên kỹ thuật",
      "mô tả mã lỗi",
      "kiểm tra nguyên nhân",
      "thay linh kiện",
      "bảo trì định kỳ",
      "chạy thử sau sửa chữa",
    ],
  },
  {
    id: "workplace-safety",
    name: "An toàn lao động và phòng ngừa rủi ro",
    count: 25,
    scope:
      "Trang bị bảo hộ, khóa nguồn, khu vực nguy hiểm, phòng cháy, hóa chất, nâng hạ, lối thoát hiểm, báo tai nạn và xử lý tình huống mất an toàn.",
    requiredSituations: [
      "mặc đồ bảo hộ",
      "đội mũ và đeo kính",
      "khóa nguồn trước bảo trì",
      "không tháo tấm chắn",
      "biển cảnh báo",
      "sử dụng hóa chất",
      "nâng hạ hàng hóa",
      "lối thoát hiểm",
      "báo sự cố an toàn",
      "sơ cứu tai nạn",
    ],
  },
  {
    id: "production-coordination",
    name: "Phối hợp sản xuất và báo cáo tiến độ",
    count: 25,
    scope:
      "Nhận kế hoạch sản xuất, xác nhận đơn hàng, thiếu nguyên liệu, điều chỉnh nhân lực, báo sản lượng, chậm tiến độ, phối hợp kho và chất lượng, đóng gói và giao hàng.",
    requiredSituations: [
      "nhận kế hoạch sản xuất",
      "xác nhận đơn hàng",
      "kiểm tra tồn kho",
      "báo thiếu nguyên liệu",
      "điều chỉnh nhân lực",
      "báo sản lượng",
      "báo chậm tiến độ",
      "phối hợp bộ phận kho",
      "đóng gói thành phẩm",
      "chuẩn bị giao hàng",
    ],
  },
];

const friendshipCategories: CategorySpec[] = [
  {
    id: "greetings-introduction",
    name: "Chào hỏi và giới thiệu bản thân",
    count: 20,
    scope:
      "Chào người mới gặp, giới thiệu tên, cách xưng hô, lý do có mặt, bày tỏ vui khi làm quen và mở đầu cuộc trò chuyện tự nhiên.",
    requiredSituations: [
      "chào lần đầu gặp mặt",
      "giới thiệu tên",
      "hỏi cách xưng hô",
      "giới thiệu ngắn về bản thân",
      "nói rất vui được làm quen",
      "hỏi đã từng gặp nhau chưa",
      "làm quen trong lớp học",
      "làm quen tại sự kiện",
      "giới thiệu một người bạn",
      "bắt đầu trò chuyện lịch sự",
    ],
  },
  {
    id: "hometown-work",
    name: "Quê quán, nơi ở, học tập và nghề nghiệp",
    count: 20,
    scope:
      "Hỏi và trả lời về quốc tịch, quê quán, thành phố đang sống, trường học, chuyên ngành, công việc và thời gian ở địa phương hiện tại.",
    requiredSituations: [
      "hỏi quê quán",
      "hỏi quốc tịch",
      "hỏi đang sống ở đâu",
      "hỏi đã ở đây bao lâu",
      "hỏi trường đang học",
      "hỏi chuyên ngành",
      "hỏi nghề nghiệp",
      "giới thiệu nơi làm việc",
      "nói lý do đến thành phố",
      "so sánh quê nhà và nơi đang sống",
    ],
  },
  {
    id: "hobbies-interests",
    name: "Sở thích và thói quen",
    count: 25,
    scope:
      "Trò chuyện về âm nhạc, phim ảnh, thể thao, đọc sách, nấu ăn, du lịch, trò chơi, thú cưng và hoạt động thường làm lúc rảnh.",
    requiredSituations: [
      "hỏi sở thích",
      "âm nhạc yêu thích",
      "phim đang xem",
      "thể thao thường chơi",
      "đọc sách",
      "nấu ăn",
      "du lịch",
      "chụp ảnh",
      "nuôi thú cưng",
      "hoạt động cuối tuần",
    ],
  },
  {
    id: "language-learning",
    name: "Học tập và học ngôn ngữ",
    count: 15,
    scope:
      "Hỏi về quá trình học tiếng Trung hoặc tiếng Việt, trình độ, kỹ năng khó, cách luyện tập, nhờ sửa phát âm và đề nghị học cùng nhau.",
    requiredSituations: [
      "hỏi học tiếng Trung bao lâu",
      "lý do học ngoại ngữ",
      "trình độ hiện tại",
      "kỹ năng khó nhất",
      "luyện nghe",
      "luyện nói",
      "nhờ sửa phát âm",
      "trao đổi ngôn ngữ",
      "giới thiệu tài liệu học",
      "rủ học cùng nhau",
    ],
  },
  {
    id: "contact-social",
    name: "WeChat và thông tin liên lạc",
    count: 15,
    scope:
      "Xin và trao đổi WeChat, số điện thoại, quét mã QR, gửi lời mời kết bạn, xác nhận đã nhận tin nhắn và giữ liên lạc.",
    requiredSituations: [
      "xin WeChat",
      "đưa mã QR",
      "quét mã kết bạn",
      "xác nhận tài khoản",
      "xin số điện thoại",
      "gửi tin nhắn thử",
      "không tìm thấy tài khoản",
      "đổi thông tin liên lạc",
      "hẹn nhắn lại",
      "nói giữ liên lạc",
    ],
  },
  {
    id: "invitations-plans",
    name: "Rủ đi ăn, uống cà phê và đi chơi",
    count: 20,
    scope:
      "Mời bạn mới ăn cơm, uống cà phê, xem phim, tham quan, tập thể thao; hỏi thời gian rảnh, chọn địa điểm, đổi lịch và xác nhận cuộc hẹn.",
    requiredSituations: [
      "rủ đi ăn",
      "rủ uống cà phê",
      "rủ xem phim",
      "rủ đi dạo",
      "rủ chơi thể thao",
      "hỏi cuối tuần có rảnh không",
      "chọn địa điểm",
      "chọn thời gian",
      "đổi lịch hẹn",
      "xác nhận cuộc hẹn",
    ],
  },
  {
    id: "daily-small-talk",
    name: "Trò chuyện đời sống hằng ngày",
    count: 15,
    scope:
      "Trò chuyện nhẹ về thời tiết, đồ ăn, giao thông, khu phố, lịch hôm nay, cuối tuần, cảm nhận về thành phố và những việc vừa xảy ra.",
    requiredSituations: [
      "nói về thời tiết",
      "hỏi đã ăn chưa",
      "món ăn yêu thích",
      "giao thông",
      "khu phố đang ở",
      "kế hoạch hôm nay",
      "cuối tuần vừa qua",
      "cảm nhận về thành phố",
      "hỏi hôm nay thế nào",
      "chia sẻ chuyện vui nhỏ",
    ],
  },
  {
    id: "conversation-reactions",
    name: "Phản hồi và duy trì cuộc trò chuyện",
    count: 10,
    scope:
      "Thể hiện ngạc nhiên, đồng tình, quan tâm, hỏi thêm chi tiết, xác nhận đã hiểu, khen ngợi phù hợp và chuyển chủ đề tự nhiên.",
    requiredSituations: [
      "thể hiện đồng tình",
      "thể hiện ngạc nhiên",
      "hỏi thật không",
      "hỏi thêm chi tiết",
      "nói mình cũng vậy",
      "khen sở thích",
      "xác nhận đã hiểu",
      "xin nhắc lại",
      "chuyển chủ đề",
      "khuyến khích kể tiếp",
    ],
  },
  {
    id: "goodbye-next-meeting",
    name: "Tạm biệt và hẹn gặp lại",
    count: 10,
    scope:
      "Kết thúc cuộc trò chuyện lịch sự, nói phải đi trước, cảm ơn, chúc một ngày tốt lành, hẹn gặp lại và xác nhận sẽ liên lạc sau.",
    requiredSituations: [
      "nói phải đi trước",
      "cảm ơn vì cuộc trò chuyện",
      "chúc một ngày vui vẻ",
      "chúc về nhà an toàn",
      "hẹn gặp lại",
      "hẹn lần sau nói tiếp",
      "hẹn nhắn tin sau",
      "xác nhận cuộc hẹn tiếp theo",
      "gửi lời chào bạn bè",
      "tạm biệt tự nhiên",
    ],
  },
];

const chinaDailyLifeCategories: CategorySpec[] = [
  {
    id: "renting-contracts",
    name: "Tìm nhà, thuê nhà và hợp đồng",
    count: 30,
    scope:
      "Tìm phòng, liên hệ chủ nhà hoặc môi giới, xem nhà, hỏi nội thất, tiền thuê, tiền cọc, ký hợp đồng, nhận phòng, gia hạn và trả nhà.",
    requiredSituations: [
      "hỏi còn phòng không",
      "đặt lịch xem nhà",
      "hỏi vị trí và khoảng cách đến tàu điện",
      "thuê nguyên căn hoặc ở ghép",
      "kiểm tra nội thất",
      "hỏi tiền thuê mỗi tháng",
      "hỏi tiền cọc",
      "thương lượng giá",
      "đọc điều khoản hợp đồng",
      "ký hợp đồng",
      "nhận chìa khóa",
      "ngày chuyển vào",
      "gia hạn hợp đồng",
      "báo trả nhà",
      "nhận lại tiền cọc",
    ],
  },
  {
    id: "utilities-payments",
    name: "Điện, nước, mạng và phí sinh hoạt",
    count: 25,
    scope:
      "Hỏi cách tính và thanh toán điện, nước, gas, internet, phí quản lý; đọc đồng hồ, nhận hóa đơn, nạp tiền và xử lý khoản thu chưa rõ.",
    requiredSituations: [
      "hỏi tiền điện",
      "hỏi tiền nước",
      "hỏi tiền gas",
      "hỏi phí quản lý",
      "đăng ký internet",
      "đọc đồng hồ điện",
      "đọc đồng hồ nước",
      "nhận hóa đơn",
      "thanh toán đúng hạn",
      "nạp tiền điện thoại",
      "hỏi khoản phí lạ",
      "xin biên lai",
      "chuyển khoản tiền nhà",
      "báo đã thanh toán",
      "xin kiểm tra lại hóa đơn",
    ],
  },
  {
    id: "repairs-appliances",
    name: "Thiết bị trong nhà và sửa chữa",
    count: 25,
    scope:
      "Sử dụng và báo hỏng điều hòa, máy giặt, tủ lạnh, bình nóng lạnh, khóa cửa, đèn, vòi nước, đường ống; hẹn thợ và xác nhận phí sửa.",
    requiredSituations: [
      "điều hòa không lạnh",
      "máy giặt không chạy",
      "tủ lạnh có vấn đề",
      "không có nước nóng",
      "mất điện",
      "mất nước",
      "vòi nước bị rò",
      "cống bị tắc",
      "khóa cửa bị hỏng",
      "đèn không sáng",
      "gọi ban quản lý",
      "hẹn thợ đến nhà",
      "mô tả lỗi",
      "hỏi phí sửa chữa",
      "xác nhận đã sửa xong",
    ],
  },
  {
    id: "delivery-addresses",
    name: "Giao hàng, đồ ăn và địa chỉ",
    count: 25,
    scope:
      "Đặt đồ ăn, mua hàng trực tuyến, ghi địa chỉ, chỉ tòa nhà và tầng, liên hệ shipper, lấy hàng ở tủ, kiểm tra bưu kiện, đổi hoặc trả hàng.",
    requiredSituations: [
      "ghi địa chỉ nhận hàng",
      "nói số tòa và số phòng",
      "chỉ tầng và lối vào",
      "gọi shipper",
      "xin giao tận cửa",
      "để hàng ở lễ tân",
      "lấy hàng ở tủ thông minh",
      "đọc mã lấy hàng",
      "đơn giao chậm",
      "không liên lạc được shipper",
      "giao nhầm địa chỉ",
      "thiếu món ăn",
      "bưu kiện bị hỏng",
      "đổi hàng",
      "trả hàng và hoàn tiền",
    ],
  },
  {
    id: "directions-transport",
    name: "Hỏi đường và giao thông",
    count: 30,
    scope:
      "Hỏi và chỉ đường, tìm ga tàu điện, bến xe, lối ra, đổi tuyến, mua vé, gọi taxi, đi xe đạp công cộng và xử lý khi đi nhầm.",
    requiredSituations: [
      "hỏi đường đến một địa điểm",
      "đi thẳng",
      "rẽ trái hoặc rẽ phải",
      "qua ngã tư",
      "tìm ga tàu điện",
      "tìm đúng lối ra",
      "mua vé tàu",
      "nạp thẻ giao thông",
      "đổi tuyến tàu",
      "hỏi còn bao nhiêu ga",
      "đi nhầm hướng",
      "lỡ chuyến xe",
      "tìm bến xe buýt",
      "gọi taxi",
      "nói điểm đến cho tài xế",
      "hỏi thời gian di chuyển",
      "gặp tắc đường",
      "thuê xe đạp công cộng",
      "quét mã mở xe",
      "hỏi đường quay về",
    ],
  },
  {
    id: "wechat-digital-services",
    name: "WeChat, điện thoại và dịch vụ số",
    count: 20,
    scope:
      "Thêm liên hệ WeChat, quét QR, gửi vị trí, gọi video, dùng nhóm chat, thanh toán điện tử, nạp tiền, đổi số điện thoại và xử lý lỗi tài khoản.",
    requiredSituations: [
      "thêm WeChat",
      "quét mã QR",
      "gửi vị trí",
      "gửi tin nhắn thoại",
      "gọi video",
      "tham gia nhóm chat",
      "tắt thông báo",
      "dùng WeChat Pay",
      "quét mã thanh toán",
      "xác nhận số tiền",
      "thanh toán thất bại",
      "số dư không đủ",
      "đổi số điện thoại",
      "quên mật khẩu",
      "tài khoản bị khóa",
    ],
  },
  {
    id: "shopping-daily-errands",
    name: "Mua sắm và việc sinh hoạt thường ngày",
    count: 20,
    scope:
      "Đi siêu thị, chợ, hiệu thuốc, giặt đồ, cắt tóc, in tài liệu, gửi bưu phẩm, mua sim và hỏi các dịch vụ thường dùng quanh nơi ở.",
    requiredSituations: [
      "hỏi giá",
      "tìm sản phẩm trong siêu thị",
      "hỏi túi đựng hàng",
      "cân rau quả",
      "mua thuốc thông thường",
      "hỏi hiệu thuốc gần nhất",
      "giặt quần áo",
      "sấy quần áo",
      "đặt lịch cắt tóc",
      "in và photocopy",
      "gửi bưu phẩm",
      "mua sim điện thoại",
      "đăng ký gói dữ liệu",
      "hỏi giờ mở cửa",
      "xin hóa đơn",
    ],
  },
  {
    id: "daily-problems-help",
    name: "Xử lý vấn đề và nhờ giúp đỡ",
    count: 25,
    scope:
      "Nhờ người khác giúp, báo mất đồ, tìm cảnh sát hoặc bệnh viện, mô tả vấn đề cơ bản, khiếu nại dịch vụ lịch sự và xử lý các tình huống bất tiện hằng ngày.",
    requiredSituations: [
      "nhờ nói chậm lại",
      "xin nhắc lại",
      "nói không hiểu",
      "nhờ viết địa chỉ",
      "mượn điện thoại",
      "điện thoại hết pin",
      "mất ví",
      "mất hộ chiếu",
      "tìm đồn cảnh sát",
      "tìm bệnh viện",
      "nói bị đau hoặc sốt",
      "xin người phiên dịch",
      "báo tiếng ồn",
      "xin hàng xóm hỗ trợ",
      "khiếu nại dịch vụ",
      "yêu cầu đổi phòng",
      "báo khóa ngoài cửa",
      "hỏi số khẩn cấp",
      "xác nhận vấn đề đã giải quyết",
      "cảm ơn vì đã giúp đỡ",
    ],
  },
];

const travelAirportCategories: CategorySpec[] = [
  {
    id: "airport-check-in",
    name: "Làm thủ tục tại sân bay",
    count: 25,
    scope:
      "Đến sân bay, tìm quầy làm thủ tục, xuất trình hộ chiếu và vé, chọn chỗ ngồi, nhận thẻ lên máy bay, hỏi cửa ra máy bay, kiểm tra an ninh, đổi chuyến và xử lý chuyến bay chậm hoặc hủy.",
    requiredSituations: [
      "tìm nhà ga và quầy làm thủ tục",
      "xuất trình hộ chiếu và vé điện tử",
      "chọn chỗ ngồi cạnh cửa sổ hoặc lối đi",
      "nhận thẻ lên máy bay",
      "hỏi cửa ra máy bay",
      "hỏi giờ bắt đầu lên máy bay",
      "qua kiểm tra an ninh",
      "bỏ chất lỏng và thiết bị điện tử ra kiểm tra",
      "hỏi chuyến bay bị chậm",
      "xử lý chuyến bay bị hủy",
      "xin đổi chuyến",
      "tìm quầy trung chuyển",
    ],
  },
  {
    id: "immigration-customs",
    name: "Nhập cảnh và hải quan",
    count: 25,
    scope:
      "Xếp hàng nhập cảnh, trình hộ chiếu và thị thực, trả lời mục đích chuyến đi, thời gian lưu trú và nơi ở, lấy dấu nhập cảnh, khai báo hải quan và hỏi quy định mang hàng hóa.",
    requiredSituations: [
      "tìm khu vực nhập cảnh",
      "xếp hàng đúng làn hộ chiếu",
      "xuất trình hộ chiếu và thị thực",
      "nói mục đích du lịch",
      "nói thời gian lưu trú",
      "cung cấp địa chỉ khách sạn",
      "trả lời có vé khứ hồi",
      "xin hỗ trợ điền tờ khai",
      "khai báo tiền mặt hoặc hàng hóa",
      "hỏi đồ nào phải khai báo",
      "đi qua cửa không khai báo",
      "hỏi nơi kiểm tra hải quan",
    ],
  },
  {
    id: "baggage-services",
    name: "Hành lý và dịch vụ hành lý",
    count: 25,
    scope:
      "Cân và ký gửi hành lý, hỏi giới hạn cân nặng, hành lý xách tay, đồ dễ vỡ, lấy hành lý, báo thất lạc hoặc hư hỏng, nhận hành lý chậm và gửi đồ tại sân bay hoặc khách sạn.",
    requiredSituations: [
      "cân hành lý ký gửi",
      "hỏi giới hạn cân nặng",
      "trả phí hành lý quá cân",
      "dán nhãn đồ dễ vỡ",
      "hỏi kích thước hành lý xách tay",
      "tìm băng chuyền nhận hành lý",
      "hỏi hành lý chưa xuất hiện",
      "báo vali bị thất lạc",
      "mô tả màu sắc và hình dạng vali",
      "báo vali bị hư hỏng",
      "để lại địa chỉ giao hành lý",
      "gửi hành lý tạm thời",
    ],
  },
  {
    id: "local-transport",
    name: "Phương tiện và di chuyển",
    count: 25,
    scope:
      "Đi từ sân bay vào thành phố bằng tàu điện, xe buýt, taxi hoặc xe đặt qua ứng dụng; mua vé, hỏi giá, điểm đón, đổi tuyến, thời gian di chuyển, địa chỉ xuống xe và thuê xe.",
    requiredSituations: [
      "tìm ga tàu điện sân bay",
      "mua vé tàu hoặc xe buýt",
      "hỏi chuyến cuối cùng",
      "tìm điểm đón taxi",
      "nói địa chỉ cho tài xế",
      "hỏi có dùng đồng hồ tính cước",
      "hỏi giá dự kiến",
      "đặt xe bằng ứng dụng",
      "xác nhận biển số xe",
      "xin dừng ở đúng địa điểm",
      "hỏi cách đổi tuyến",
      "hỏi thời gian đến nơi",
      "thuê xe và hỏi tiền đặt cọc",
    ],
  },
  {
    id: "hotel-stay",
    name: "Khách sạn và lưu trú",
    count: 25,
    scope:
      "Đặt phòng, xác nhận thông tin, nhận và trả phòng, đặt cọc, hỏi bữa sáng và tiện nghi, yêu cầu dọn phòng, báo thiết bị hỏng, đổi phòng, gửi hành lý và nhờ lễ tân hỗ trợ.",
    requiredSituations: [
      "xác nhận đặt phòng",
      "đăng ký nhận phòng",
      "xuất trình hộ chiếu",
      "hỏi tiền đặt cọc",
      "xin phòng không hút thuốc",
      "hỏi giờ ăn sáng",
      "hỏi mật khẩu Wi-Fi",
      "yêu cầu dọn phòng",
      "xin thêm khăn hoặc nước",
      "báo điều hòa hoặc nước nóng bị hỏng",
      "xin đổi phòng vì tiếng ồn",
      "hỏi giờ trả phòng",
      "gửi hành lý sau khi trả phòng",
    ],
  },
  {
    id: "travel-emergencies",
    name: "Tình huống khẩn cấp khi du lịch",
    count: 25,
    scope:
      "Nhờ giúp đỡ khi bị lạc, mất hộ chiếu hoặc ví, điện thoại hết pin, bị thương hoặc không khỏe, cần cảnh sát, bệnh viện, đại sứ quán, phiên dịch, bảo hiểm hoặc liên hệ người thân.",
    requiredSituations: [
      "nói mình bị lạc",
      "xin dùng điện thoại",
      "xin sạc điện thoại",
      "báo mất hộ chiếu",
      "báo mất ví hoặc thẻ ngân hàng",
      "tìm đồn cảnh sát",
      "liên hệ đại sứ quán",
      "tìm bệnh viện hoặc nhà thuốc",
      "nói triệu chứng cơ bản",
      "gọi xe cứu thương",
      "xin người phiên dịch",
      "liên hệ bảo hiểm du lịch",
      "gọi cho người thân",
      "báo đồ bị đánh cắp",
    ],
  },
];

const salesCustomerServiceCategories: CategorySpec[] = [
  {
    id: "customer-needs",
    name: "Chào hỏi và tìm hiểu nhu cầu",
    count: 25,
    scope:
      "Đón tiếp khách, chủ động hỗ trợ, hỏi mục đích sử dụng, ngân sách, số lượng, kích thước, màu sắc, thời hạn cần hàng và xác nhận tiêu chí ưu tiên trước khi tư vấn.",
    requiredSituations: [
      "chào và hỏi khách cần hỗ trợ gì",
      "hỏi mục đích sử dụng",
      "hỏi ngân sách dự kiến",
      "hỏi số lượng cần mua",
      "hỏi kích thước hoặc thông số",
      "hỏi màu sắc và kiểu dáng",
      "hỏi thời gian cần nhận hàng",
      "hỏi đã từng dùng sản phẩm chưa",
      "xác nhận nhu cầu quan trọng nhất",
      "hỏi mua cho cá nhân hay doanh nghiệp",
      "ghi nhận thông tin liên hệ",
      "nhắc lại nhu cầu để xác nhận",
    ],
  },
  {
    id: "product-consulting",
    name: "Tư vấn và giới thiệu sản phẩm",
    count: 25,
    scope:
      "Giới thiệu tính năng, công dụng, chất liệu, xuất xứ, thông số, ưu nhược điểm, cách dùng, bảo hành, hàng có sẵn, mẫu thay thế và so sánh các lựa chọn phù hợp.",
    requiredSituations: [
      "giới thiệu sản phẩm phù hợp",
      "giải thích tính năng chính",
      "nói về chất liệu",
      "nói về xuất xứ",
      "giải thích thông số",
      "so sánh hai mẫu",
      "nêu ưu điểm",
      "nói rõ hạn chế",
      "hướng dẫn cách sử dụng",
      "giải thích thời hạn bảo hành",
      "báo tình trạng còn hàng",
      "đề xuất mẫu thay thế",
      "cho khách dùng thử hoặc xem mẫu",
    ],
  },
  {
    id: "quotation-pricing",
    name: "Báo giá và điều kiện bán hàng",
    count: 25,
    scope:
      "Báo giá lẻ và giá sỉ, giải thích giá đã gồm thuế hay chưa, phí vận chuyển, chiết khấu theo số lượng, thời hạn hiệu lực của báo giá, phương thức thanh toán, đặt cọc và xuất hóa đơn.",
    requiredSituations: [
      "báo giá sản phẩm",
      "phân biệt giá lẻ và giá sỉ",
      "giải thích giá đã gồm thuế",
      "báo phí vận chuyển",
      "chiết khấu theo số lượng",
      "thời hạn hiệu lực của báo giá",
      "gửi bảng báo giá",
      "xác nhận đơn vị tiền tệ",
      "hỏi phương thức thanh toán",
      "yêu cầu đặt cọc",
      "xác nhận thời hạn thanh toán",
      "xuất hóa đơn",
    ],
  },
  {
    id: "negotiation-order",
    name: "Thương lượng và chốt đơn",
    count: 25,
    scope:
      "Tiếp nhận đề nghị giảm giá, thương lượng số lượng và điều kiện giao hàng, xin phê duyệt giá, đưa phương án thay thế, xác nhận sản phẩm, số lượng, địa chỉ, thời gian giao và hoàn tất đơn hàng.",
    requiredSituations: [
      "khách đề nghị giảm giá",
      "thương lượng mức chiết khấu",
      "xin quản lý phê duyệt giá",
      "đề xuất tăng số lượng để có giá tốt",
      "thương lượng phí vận chuyển",
      "thống nhất ngày giao hàng",
      "đề xuất phương án thay thế",
      "xác nhận mẫu và số lượng",
      "xác nhận địa chỉ giao hàng",
      "xác nhận thông tin người nhận",
      "tóm tắt điều kiện đã thống nhất",
      "chốt và xác nhận đơn hàng",
    ],
  },
  {
    id: "after-sales-follow-up",
    name: "Theo dõi và chăm sóc sau bán",
    count: 25,
    scope:
      "Thông báo trạng thái đơn, xác nhận giao hàng, hỏi trải nghiệm sử dụng, hướng dẫn kích hoạt bảo hành, nhắc lịch bảo trì, hỗ trợ đổi trả và tiếp nhận góp ý để duy trì quan hệ khách hàng.",
    requiredSituations: [
      "xác nhận đã nhận đơn hàng",
      "thông báo đang chuẩn bị hàng",
      "gửi mã vận đơn",
      "thông báo giao hàng chậm",
      "xác nhận khách đã nhận hàng",
      "hỏi trải nghiệm sử dụng",
      "hướng dẫn kích hoạt bảo hành",
      "nhắc lịch bảo trì",
      "hướng dẫn đổi hoặc trả hàng",
      "gửi tài liệu hướng dẫn",
      "cảm ơn phản hồi của khách",
      "mời khách liên hệ khi cần hỗ trợ",
    ],
  },
  {
    id: "complaints-resolution",
    name: "Phản hồi và xử lý khiếu nại",
    count: 25,
    scope:
      "Lắng nghe khiếu nại về giao sai, thiếu hàng, hàng hỏng, chất lượng, phí, thái độ phục vụ hoặc hoàn tiền; xin lỗi đúng mức, xác minh chứng từ, đưa thời hạn xử lý và giải pháp cụ thể.",
    requiredSituations: [
      "xin lỗi vì trải nghiệm không tốt",
      "hỏi rõ nội dung khiếu nại",
      "xin mã đơn hàng",
      "xin ảnh hoặc video sản phẩm lỗi",
      "xác minh giao sai sản phẩm",
      "xác minh thiếu số lượng",
      "xử lý hàng hư hỏng",
      "giải thích khoản phí",
      "đề nghị đổi sản phẩm",
      "xác nhận hoàn tiền",
      "nói rõ thời gian xử lý",
      "chuyển vụ việc cho bộ phận phụ trách",
      "xác nhận khách đồng ý với giải pháp",
    ],
  },
];

const logisticsImportExportCategories: CategorySpec[] = [
  {
    id: "sourcing-purchasing",
    name: "Tìm nguồn hàng và mua hàng",
    count: 25,
    scope:
      "Tìm nhà cung cấp, gửi yêu cầu báo giá, hỏi số lượng đặt tối thiểu, xin mẫu, xác nhận quy cách, năng lực cung ứng, thời gian sản xuất, số lượng và tiến độ đơn mua.",
    requiredSituations: [
      "tìm và đánh giá nhà cung cấp",
      "gửi yêu cầu báo giá",
      "hỏi số lượng đặt tối thiểu",
      "xin và xác nhận mẫu",
      "xác nhận quy cách sản phẩm",
      "hỏi năng lực cung ứng",
      "hỏi thời gian sản xuất",
      "xác nhận số lượng đặt hàng",
      "đề nghị điều chỉnh đơn mua",
      "theo dõi tiến độ chuẩn bị hàng",
      "xác nhận chất lượng trước khi đặt",
      "phê duyệt đơn mua",
    ],
  },
  {
    id: "contracts-trade-terms-payment",
    name: "Hợp đồng, Incoterms và thanh toán",
    count: 25,
    scope:
      "Trao đổi điều khoản hợp đồng, giá, tiền tệ, đặt cọc, thời hạn thanh toán, chuyển khoản, thư tín dụng, trách nhiệm chi phí, bảo hiểm và thời điểm chuyển giao rủi ro theo điều kiện thương mại.",
    requiredSituations: [
      "xác nhận điều khoản hợp đồng",
      "thương lượng giá và tiền tệ",
      "yêu cầu đặt cọc",
      "xác nhận thời hạn thanh toán",
      "thanh toán bằng chuyển khoản",
      "mở thư tín dụng",
      "xác nhận tài khoản nhận tiền",
      "chọn điều kiện FOB",
      "chọn điều kiện CIF",
      "chọn điều kiện EXW",
      "phân chia cước và phí bảo hiểm",
      "xác định thời điểm chuyển giao rủi ro",
    ],
  },
  {
    id: "trade-documents",
    name: "Chứng từ xuất nhập khẩu",
    count: 25,
    scope:
      "Chuẩn bị, kiểm tra và sửa hóa đơn thương mại, phiếu đóng gói, vận đơn, chứng nhận xuất xứ, giấy phép, chứng thư kiểm dịch, chứng từ bảo hiểm và thông báo vận chuyển.",
    requiredSituations: [
      "gửi hóa đơn thương mại",
      "kiểm tra phiếu đóng gói",
      "xác nhận vận đơn",
      "xin chứng nhận xuất xứ",
      "chuẩn bị giấy phép nhập khẩu",
      "gửi chứng thư kiểm dịch",
      "kiểm tra bản gốc và bản sao",
      "ký tên đóng dấu chứng từ",
      "yêu cầu sửa chứng từ",
      "đối chiếu thông tin giữa các chứng từ",
      "gửi thông báo vận chuyển",
      "bổ sung chứng từ còn thiếu",
    ],
  },
  {
    id: "customs-compliance",
    name: "Hải quan và tuân thủ",
    count: 25,
    scope:
      "Phân loại mã HS, khai báo trị giá, tính thuế, nộp hồ sơ, kiểm hóa, bổ sung tài liệu, xin giấy phép, xử lý luồng kiểm tra, theo dõi thông quan và nhận thông báo giải phóng hàng.",
    requiredSituations: [
      "xác nhận mã HS",
      "khai báo trị giá hải quan",
      "hỏi thuế nhập khẩu",
      "nộp tờ khai hải quan",
      "bổ sung hồ sơ",
      "nhận thông báo kiểm hóa",
      "phối hợp kiểm tra hàng",
      "giải trình chênh lệch khai báo",
      "kiểm tra hàng hạn chế nhập khẩu",
      "theo dõi trạng thái thông quan",
      "nhận thông báo giải phóng hàng",
      "làm việc với đại lý khai báo",
    ],
  },
  {
    id: "warehouse-transport-delivery",
    name: "Kho bãi, vận tải và giao nhận",
    count: 25,
    scope:
      "Nhập xuất kho, kiểm kê, đóng gói, ghi nhãn, đặt chỗ vận chuyển, container, lịch tàu hoặc chuyến bay, theo dõi lô hàng, lấy hàng, giao hàng và ký nhận.",
    requiredSituations: [
      "xác nhận nhập kho",
      "lập phiếu xuất kho",
      "kiểm kê tồn kho",
      "xác nhận quy cách đóng gói",
      "dán nhãn vận chuyển",
      "đặt chỗ vận tải",
      "xác nhận container",
      "hỏi lịch tàu hoặc chuyến bay",
      "theo dõi vị trí lô hàng",
      "xác nhận thời gian lấy hàng",
      "xác nhận địa chỉ giao hàng",
      "ký nhận và bàn giao hàng",
    ],
  },
  {
    id: "exceptions-claims",
    name: "Sự cố, khiếu nại và bồi thường",
    count: 25,
    scope:
      "Báo giao chậm, thiếu hàng, giao sai, mất hàng, hư hỏng, sai chứng từ, phí phát sinh, lưu container, thu thập bằng chứng, lập biên bản, yêu cầu bồi thường và theo dõi xử lý.",
    requiredSituations: [
      "báo giao hàng chậm",
      "báo thiếu số lượng",
      "báo giao sai hàng",
      "báo mất hàng",
      "báo hàng hư hỏng",
      "báo bao bì bị rách",
      "sửa chứng từ sai",
      "hỏi phí lưu container",
      "chụp ảnh và lưu bằng chứng",
      "lập báo cáo bất thường",
      "gửi yêu cầu bồi thường",
      "theo dõi tiến độ giải quyết khiếu nại",
    ],
  },
];

const commercialContractNegotiationCategories: CategorySpec[] = [
  {
    id: "quotations-pricing",
    name: "Báo giá và chính sách giá",
    count: 25,
    scope:
      "Hỏi và gửi báo giá, xác nhận đơn vị tiền tệ, thời hạn hiệu lực, thuế, phí, số lượng tối thiểu, giá theo số lượng và giải thích các thành phần trong báo giá.",
    requiredSituations: [
      "yêu cầu báo giá chính thức",
      "gửi bảng báo giá",
      "xác nhận đơn vị tiền tệ",
      "hỏi giá đã gồm thuế chưa",
      "hỏi phí phát sinh",
      "xác nhận thời hạn hiệu lực của báo giá",
      "hỏi số lượng đặt tối thiểu",
      "hỏi giá theo số lượng",
      "so sánh hai phương án giá",
      "giải thích thành phần báo giá",
      "đề nghị cập nhật báo giá",
      "xác nhận giá cuối cùng",
    ],
  },
  {
    id: "negotiation-discounts",
    name: "Thương lượng và chiết khấu",
    count: 25,
    scope:
      "Đề xuất và phản hồi mức giá, chiết khấu, số lượng, thời gian giao, điều kiện thanh toán, ưu đãi cho hợp tác dài hạn và phương án nhượng bộ có điều kiện.",
    requiredSituations: [
      "đề nghị giảm giá",
      "đề nghị chiết khấu theo số lượng",
      "giải thích giới hạn giảm giá",
      "đưa ra giá mục tiêu",
      "đề nghị nhượng bộ hai bên",
      "đổi giá lấy số lượng lớn hơn",
      "đổi chiết khấu lấy thanh toán sớm",
      "thương lượng thời gian giao",
      "thương lượng điều kiện thanh toán",
      "ưu đãi cho hợp tác dài hạn",
      "đưa ra phương án thay thế",
      "xác nhận kết quả đàm phán",
    ],
  },
  {
    id: "contract-terms-signing",
    name: "Điều khoản, ký kết và gia hạn hợp đồng",
    count: 25,
    scope:
      "Rà soát phạm vi, quyền và nghĩa vụ, tiêu chuẩn nghiệm thu, bảo mật, vi phạm, chấm dứt, sửa đổi, ký đóng dấu, hiệu lực và gia hạn hợp đồng.",
    requiredSituations: [
      "gửi dự thảo hợp đồng",
      "rà soát điều khoản",
      "xác nhận phạm vi hợp tác",
      "làm rõ quyền và nghĩa vụ",
      "thống nhất tiêu chuẩn nghiệm thu",
      "bổ sung điều khoản bảo mật",
      "sửa điều khoản vi phạm",
      "thống nhất điều kiện chấm dứt",
      "đề nghị sửa đổi phụ lục",
      "ký tên và đóng dấu",
      "xác nhận ngày có hiệu lực",
      "đề nghị gia hạn hợp đồng",
    ],
  },
  {
    id: "orders-payment-delivery",
    name: "Đơn hàng, thanh toán và giao hàng",
    count: 25,
    scope:
      "Xác nhận đơn, đặt cọc, lịch thanh toán, tài khoản nhận tiền, hóa đơn, lịch giao, thay đổi số lượng, theo dõi tiến độ và xác nhận hoàn tất nghĩa vụ.",
    requiredSituations: [
      "xác nhận đơn đặt hàng",
      "xác nhận tiền đặt cọc",
      "thống nhất lịch thanh toán",
      "xác minh tài khoản nhận tiền",
      "gửi chứng từ thanh toán",
      "yêu cầu xuất hóa đơn",
      "xác nhận lịch giao hàng",
      "đề nghị thay đổi số lượng",
      "theo dõi tiến độ thực hiện đơn",
      "báo chậm giao hàng",
      "xác nhận đã nhận đủ hàng",
      "xác nhận hoàn tất thanh toán",
    ],
  },
  {
    id: "receivables-reconciliation",
    name: "Công nợ, hóa đơn và đối soát",
    count: 25,
    scope:
      "Đối chiếu số dư, kiểm tra hóa đơn, xác nhận khoản phải thu hoặc phải trả, xử lý chênh lệch, nhắc thanh toán, lập biên bản và xác nhận công nợ.",
    requiredSituations: [
      "gửi bảng đối chiếu công nợ",
      "xác nhận số dư đầu kỳ",
      "kiểm tra khoản phải thu",
      "kiểm tra khoản phải trả",
      "đối chiếu hóa đơn",
      "phát hiện chênh lệch",
      "yêu cầu bổ sung chứng từ",
      "giải thích khoản khấu trừ",
      "nhắc khoản thanh toán đến hạn",
      "đề nghị lịch thanh toán",
      "lập biên bản đối soát",
      "xác nhận công nợ cuối kỳ",
    ],
  },
  {
    id: "partnership-after-sales-disputes",
    name: "Đối tác, hậu mãi và xử lý tranh chấp",
    count: 25,
    scope:
      "Trao đổi với đại lý và nhà phân phối, chính sách khu vực, hỗ trợ bán hàng, bảo hành, đổi trả, khiếu nại, thu thập bằng chứng, phương án khắc phục và giải quyết tranh chấp.",
    requiredSituations: [
      "đề nghị hợp tác đại lý",
      "trao đổi chính sách phân phối",
      "xác nhận khu vực bán hàng",
      "hỏi hỗ trợ quảng bá",
      "xác nhận chính sách bảo hành",
      "yêu cầu đổi hoặc trả hàng",
      "tiếp nhận khiếu nại",
      "yêu cầu cung cấp bằng chứng",
      "đề xuất phương án khắc phục",
      "thương lượng mức bồi thường",
      "xử lý bất đồng hợp đồng",
      "xác nhận kết quả giải quyết",
    ],
  },
];

const workCallsMessagesCategories: CategorySpec[] = [
  {
    id: "starting-receiving-calls",
    name: "Mở đầu và tiếp nhận cuộc gọi",
    count: 20,
    scope:
      "Chào hỏi qua điện thoại, giới thiệu bản thân và công ty, hỏi người cần gặp, xác nhận mục đích cuộc gọi, kiểm tra người nghe có tiện nói chuyện và phản hồi khi nhận cuộc gọi.",
    requiredSituations: [
      "chào và giới thiệu qua điện thoại",
      "hỏi người cần gặp",
      "xác nhận đúng số điện thoại",
      "nói rõ mục đích cuộc gọi",
      "hỏi người nghe có tiện nói chuyện",
      "xác nhận danh tính người gọi",
      "tiếp nhận cuộc gọi từ khách hàng",
      "tiếp nhận cuộc gọi từ đối tác",
      "xin người gọi chờ một chút",
      "cảm ơn người gọi",
    ],
  },
  {
    id: "transferring-messages-callbacks",
    name: "Chuyển máy, để lại lời nhắn và gọi lại",
    count: 20,
    scope:
      "Chuyển cuộc gọi, báo người cần gặp đang bận hoặc vắng mặt, xin tên và số liên hệ, ghi lời nhắn, nhắc gọi lại, hẹn thời gian gọi và xác nhận đã chuyển thông tin.",
    requiredSituations: [
      "chuyển máy cho đồng nghiệp",
      "báo máy lẻ đang bận",
      "báo người cần gặp đang họp",
      "báo người cần gặp vắng mặt",
      "xin tên người gọi",
      "xin số điện thoại liên hệ",
      "đề nghị để lại lời nhắn",
      "ghi lại nội dung lời nhắn",
      "hẹn giờ gọi lại",
      "xác nhận sẽ chuyển lời",
    ],
  },
  {
    id: "confirming-work-information",
    name: "Xác nhận thông tin công việc qua điện thoại",
    count: 20,
    scope:
      "Xác nhận lịch hẹn, thời gian họp, địa chỉ, email, tên tài liệu, số lượng, tiến độ, yêu cầu công việc và nhắc gửi lại thông tin bằng văn bản.",
    requiredSituations: [
      "xác nhận lịch hẹn",
      "xác nhận thời gian họp",
      "xác nhận địa điểm",
      "đọc lại địa chỉ email",
      "xác nhận tên tài liệu",
      "xác nhận số lượng",
      "hỏi tiến độ công việc",
      "làm rõ yêu cầu",
      "đọc lại thông tin quan trọng",
      "đề nghị gửi xác nhận bằng văn bản",
    ],
  },
  {
    id: "wechat-work-messages",
    name: "Nhắn tin WeChat trong công việc",
    count: 20,
    scope:
      "Thêm liên hệ, gửi lời mời kết bạn, nhắn mở đầu, gửi tài liệu và hình ảnh, nhắc phản hồi, báo tiến độ, xin xác nhận, tạo nhóm và kết thúc trao đổi lịch sự.",
    requiredSituations: [
      "xin thêm WeChat",
      "gửi lời mời kết bạn",
      "tự giới thiệu trong tin nhắn",
      "gửi tài liệu qua WeChat",
      "gửi hình ảnh hoặc vị trí",
      "nhắc kiểm tra tin nhắn",
      "nhắc phản hồi",
      "báo tiến độ ngắn",
      "tạo nhóm làm việc",
      "xác nhận đã nhận thông tin",
    ],
  },
  {
    id: "connection-problems-etiquette",
    name: "Sự cố liên lạc và phép lịch sự",
    count: 20,
    scope:
      "Xử lý tín hiệu yếu, nghe không rõ, cuộc gọi bị ngắt, nhầm số, tiếng ồn, yêu cầu nói chậm hoặc nhắc lại, chuyển sang nhắn tin và kết thúc cuộc gọi chuyên nghiệp.",
    requiredSituations: [
      "tín hiệu điện thoại yếu",
      "nghe không rõ",
      "đề nghị nói chậm",
      "đề nghị nhắc lại",
      "cuộc gọi bị ngắt",
      "gọi nhầm số",
      "môi trường quá ồn",
      "đề nghị chuyển sang nhắn tin",
      "xin lỗi vì làm phiền",
      "kết thúc cuộc gọi lịch sự",
    ],
  },
];

const categories = isFactoryTemplate
  ? factoryCategories
  : isFriendshipTemplate
    ? friendshipCategories
    : isChinaDailyLifeTemplate
      ? chinaDailyLifeCategories
      : isTravelAirportTemplate
        ? travelAirportCategories
        : isSalesCustomerServiceTemplate
          ? salesCustomerServiceCategories
          : isLogisticsImportExportTemplate
            ? logisticsImportExportCategories
            : isCommercialContractNegotiationTemplate
              ? commercialContractNegotiationCategories
              : isWorkCallsMessagesTemplate
                ? workCallsMessagesCategories
                : officeCategories;

const highlightWordSchema = z.object({
  chinese: z.string().min(1),
  pinyin: z.string().min(1),
  meaning_vi: z.string().min(1),
});

const responseSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().min(1),
      sentence_cn: z.string().min(3),
      sentence_pinyin: z.string().min(3),
      sentence_vi: z.string().min(3),
      vocabulary: z.array(highlightWordSchema).min(1).max(maxHighlightWords),
    }),
  ),
});

const officeDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "午休时间到了，请大家及时休息。": {
    sentence_vi: "Đến giờ nghỉ trưa rồi, mọi người nghỉ ngơi một chút nhé.",
  },
  "目前我们正在解决软件开发中的几个关键BUG。": {
    sentence_cn: "目前我们正在解决软件开发中的几个关键缺陷。",
    sentence_pinyin:
      "Mùqián wǒmen zhèngzài jiějué ruǎnjiàn kāifā zhōng de jǐ gè guānjiàn quēxiàn.",
    sentence_vi:
      "Hiện tại chúng tôi đang xử lý một số lỗi quan trọng trong phần mềm.",
    vocabulary: [
      {
        chinese: "关键缺陷",
        pinyin: "guānjiàn quēxiàn",
        meaning_vi: "lỗi quan trọng, khiếm khuyết nghiêm trọng",
      },
    ],
  },
  "由于团队成员缺乏经验，导致任务进展出现了瓶颈。": {
    sentence_vi:
      "Do các thành viên trong nhóm còn thiếu kinh nghiệm nên tiến độ công việc gặp điểm nghẽn.",
  },
  "请将任务分解并合理分配给团队成员，确保效率。": {
    sentence_vi:
      "Hãy chia nhỏ và phân công nhiệm vụ hợp lý cho các thành viên để bảo đảm hiệu quả.",
  },
  "今天的会议程序将包括项目进展和预算审核。": {
    sentence_cn: "今天的会议议程包括项目进展和预算审核。",
    sentence_pinyin:
      "Jīntiān de huìyì yìchéng bāokuò xiàngmù jìnzhǎn hé yùsuàn shěnhé.",
    sentence_vi:
      "Chương trình họp hôm nay gồm tiến độ dự án và phần xét duyệt ngân sách.",
    vocabulary: [
      {
        chinese: "会议议程",
        pinyin: "huìyì yìchéng",
        meaning_vi: "chương trình, nội dung cuộc họp",
      },
      {
        chinese: "项目进展",
        pinyin: "xiàngmù jìnzhǎn",
        meaning_vi: "tiến độ dự án",
      },
      {
        chinese: "预算审核",
        pinyin: "yùsuàn shěnhé",
        meaning_vi: "xét duyệt ngân sách",
      },
    ],
  },
  "请大家务必在会议结束后填写会议纪要。": {
    sentence_cn: "请记录员在会议结束后整理会议纪要。",
    sentence_pinyin:
      "Qǐng jìlùyuán zài huìyì jiéshù hòu zhěnglǐ huìyì jìyào.",
    sentence_vi:
      "Sau cuộc họp, vui lòng nhờ người ghi biên bản tổng hợp nội dung cuộc họp.",
    vocabulary: [
      {
        chinese: "记录员",
        pinyin: "jìlùyuán",
        meaning_vi: "người ghi biên bản",
      },
      {
        chinese: "整理",
        pinyin: "zhěnglǐ",
        meaning_vi: "sắp xếp, tổng hợp",
      },
      {
        chinese: "会议纪要",
        pinyin: "huìyì jìyào",
        meaning_vi: "biên bản cuộc họp",
      },
    ],
  },
  "今天因为天气原因，交通繁忙导致同事们普遍迟到。": {
    sentence_vi:
      "Hôm nay do thời tiết và giao thông đông đúc nên nhiều đồng nghiệp đến muộn.",
  },
  "收到您的邮件，我会尽快安排对接相关工作。": {
    sentence_vi:
      "Tôi đã nhận được email và sẽ sớm sắp xếp người phối hợp công việc liên quan.",
  },
  "请遵守邮件礼仪，避免使用过于随意的语言。": {
    sentence_vi:
      "Vui lòng tuân thủ phép lịch sự khi viết email và tránh dùng ngôn ngữ quá tùy tiện.",
  },
  "总结今天会议，我们达成了几个重要共识。": {
    sentence_vi:
      "Tổng kết cuộc họp hôm nay, chúng ta đã đạt được một số đồng thuận quan trọng.",
  },
};
const factoryDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "今天的生产计划已交代清楚，请按要求执行。": {
    sentence_vi:
      "Kế hoạch sản xuất hôm nay đã được bàn giao rõ ràng, vui lòng thực hiện đúng yêu cầu.",
  },
  "请核对产品数量，确保无误后再交接。": {
    sentence_vi:
      "Vui lòng đối chiếu số lượng sản phẩm, xác nhận chính xác rồi mới bàn giao.",
  },
  "接班人员如有问题，请及时沟通反馈。": {
    sentence_vi:
      "Nếu có vấn đề, nhân viên nhận ca vui lòng trao đổi và phản hồi kịp thời.",
  },
  "每天作业结束后，必须对设备进行彻底清洁维护。": {
    sentence_vi:
      "Sau khi kết thúc công việc mỗi ngày, phải vệ sinh kỹ và bảo dưỡng thiết bị.",
  },
  "操作期间请密切观察仪表，及时发现异常数据。": {
    sentence_vi:
      "Trong quá trình vận hành, hãy theo dõi sát đồng hồ đo để kịp thời phát hiện số liệu bất thường.",
  },
  "每日工作前请仔细检查所有传动部件的润滑情况。": {
    sentence_vi:
      "Trước mỗi ngày làm việc, hãy kiểm tra kỹ tình trạng bôi trơn của tất cả bộ phận truyền động.",
  },
  "加注润滑油时应避免过量，防止污染产品。": {
    sentence_vi:
      "Khi châm dầu bôi trơn, tránh châm quá mức để không làm bẩn sản phẩm.",
  },
  "请将检测不合格的产品放入隔离区，避免混入良品。": {
    sentence_vi:
      "Vui lòng đưa sản phẩm không đạt vào khu cách ly để tránh lẫn với hàng đạt chuẩn.",
  },
  "请技术员复检有争议的样品，确保数据准确。": {
    sentence_vi:
      "Hãy nhờ kỹ thuật viên kiểm tra lại mẫu có kết quả chưa thống nhất để bảo đảm số liệu chính xác.",
  },
  "需要二次检验的产品，请标记并通知质检部门。": {
    sentence_vi:
      "Hãy đánh dấu sản phẩm cần kiểm tra lần hai và thông báo cho bộ phận kiểm tra chất lượng.",
  },
  "为保证检测准确，请严格按照操作规程执行。": {
    sentence_vi:
      "Để bảo đảm kết quả kiểm tra chính xác, vui lòng tuân thủ nghiêm quy trình vận hành.",
  },
  "质量异常报告必须及时上报，避免影响生产进度。": {
    sentence_vi:
      "Báo cáo bất thường về chất lượng phải được gửi kịp thời để tránh ảnh hưởng tiến độ sản xuất.",
  },
  "机器出现E12故障代码，可能是传感器信号异常导致。": {
    sentence_cn:
      "机器显示十二号故障代码，可能是传感器信号异常导致。",
    sentence_pinyin:
      "Jīqì xiǎnshì shí'èr hào gùzhàng dàimǎ, kěnéng shì chuángǎnqì xìnhào yìcháng dǎozhì.",
    sentence_vi:
      "Máy hiển thị mã lỗi số 12, có thể do tín hiệu cảm biến bất thường.",
    vocabulary: [
      {
        chinese: "故障代码",
        pinyin: "gùzhàng dàimǎ",
        meaning_vi: "mã lỗi",
      },
      {
        chinese: "传感器",
        pinyin: "chuángǎnqì",
        meaning_vi: "cảm biến",
      },
      {
        chinese: "信号异常",
        pinyin: "xìnhào yìcháng",
        meaning_vi: "tín hiệu bất thường",
      },
    ],
  },
  "检测发现排气系统堵塞，需要及时清理并更换滤芯。": {
    sentence_vi:
      "Kiểm tra phát hiện hệ thống thoát khí bị tắc, cần vệ sinh kịp thời và thay lõi lọc.",
  },
  "维修过程中应记录所有更换零件编号和使用时间。": {
    sentence_vi:
      "Trong quá trình sửa chữa, cần ghi lại mã số và thời gian sử dụng của tất cả linh kiện được thay.",
  },
  "对设备进行例行维护，清理灰尘和检查紧固件状态。": {
    sentence_vi:
      "Thực hiện bảo trì định kỳ, vệ sinh bụi và kiểm tra tình trạng các chi tiết liên kết của thiết bị.",
  },
  "进入车间请戴好安全帽和防护眼镜，避免飞溅伤害。": {
    sentence_vi:
      "Khi vào xưởng, hãy đội mũ và đeo kính bảo hộ để tránh vật bắn văng gây thương tích.",
  },
  "未经许可不得拆卸机械保护罩，防止意外伤害发生。": {
    sentence_vi:
      "Khi chưa được phép, tuyệt đối không tháo tấm chắn bảo vệ của máy để tránh tai nạn.",
  },
  "车间入口处设有明显的安全警示标志，请勿随意进入。": {
    sentence_vi:
      "Lối vào xưởng có biển cảnh báo an toàn rõ ràng, vui lòng không tự ý đi vào.",
  },
  "操作车间设备前必须确认所有安全防护装置已开启。": {
    sentence_vi:
      "Trước khi vận hành thiết bị trong xưởng, phải xác nhận tất cả cơ cấu bảo vệ an toàn đã được bật.",
  },
  "禁止在生产区域内吸烟，防止火灾和爆炸危险。": {
    sentence_vi:
      "Cấm hút thuốc trong khu vực sản xuất để phòng ngừa nguy cơ cháy nổ.",
  },
  "操作高温设备时，必须穿戴隔热手套和防护面罩。": {
    sentence_vi:
      "Khi vận hành thiết bị nhiệt độ cao, phải đeo găng tay cách nhiệt và tấm che mặt bảo hộ.",
  },
  "生产现场请保持地面干净整洁，防止滑倒和跌落事故。": {
    sentence_vi:
      "Hãy giữ sàn khu vực sản xuất sạch sẽ, gọn gàng để phòng tránh tai nạn trượt và té ngã.",
  },
  "请配合质检部门，做好成品的最终包装和标识。": {
    sentence_vi:
      "Vui lòng phối hợp với bộ phận kiểm tra chất lượng để hoàn tất đóng gói và ghi nhãn thành phẩm.",
  },
  "请提前准备好运输车辆，确保按时发货。": {
    sentence_vi:
      "Vui lòng chuẩn bị trước phương tiện vận chuyển để bảo đảm giao hàng đúng hạn.",
  },
  "接收订单后，请立刻安排物流部门发货。": {
    sentence_cn: "成品入库后，请及时安排物流部门发货。",
    sentence_pinyin:
      "Chéngpǐn rùkù hòu, qǐng jíshí ānpái wùliú bùmén fāhuò.",
    sentence_vi:
      "Sau khi thành phẩm nhập kho, vui lòng sắp xếp bộ phận logistics giao hàng kịp thời.",
    vocabulary: [
      {
        chinese: "成品入库",
        pinyin: "chéngpǐn rùkù",
        meaning_vi: "thành phẩm nhập kho",
      },
      {
        chinese: "物流部门",
        pinyin: "wùliú bùmén",
        meaning_vi: "bộ phận logistics",
      },
      {
        chinese: "发货",
        pinyin: "fāhuò",
        meaning_vi: "giao hàng, xuất hàng",
      },
    ],
  },
  "发现包装材料不足，请提前通知采购部门补充。": {
    sentence_vi:
      "Nếu phát hiện thiếu vật liệu đóng gói, hãy kịp thời thông báo bộ phận mua hàng bổ sung.",
  },
  "请确认所有生产设备已准备就绪，确保开工顺利。": {
    sentence_vi:
      "Vui lòng xác nhận tất cả thiết bị đã sẵn sàng để quá trình sản xuất diễn ra thuận lợi.",
  },
};
const friendshipDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "请问，我们怎么称呼你？": {
    sentence_cn: "请问，我该怎么称呼你？",
    sentence_pinyin: "Qǐngwèn, wǒ gāi zěnme chēnghu nǐ?",
    sentence_vi: "Xin hỏi, tôi nên xưng hô với bạn thế nào?",
    vocabulary: [
      {
        chinese: "称呼",
        pinyin: "chēnghu",
        meaning_vi: "xưng hô, cách gọi",
      },
    ],
  },
  "你平时喜欢做什么工作？": {
    sentence_cn: "你平时喜欢参加什么活动？",
    sentence_pinyin: "Nǐ píngshí xǐhuan cānjiā shénme huódòng?",
    sentence_vi: "Bạn thường thích tham gia hoạt động gì?",
    vocabulary: [
      {
        chinese: "参加",
        pinyin: "cānjiā",
        meaning_vi: "tham gia",
      },
      {
        chinese: "活动",
        pinyin: "huódòng",
        meaning_vi: "hoạt động",
      },
    ],
  },
  "你每天上学几点钟开始？": {
    sentence_cn: "你每天几点开始上课？",
    sentence_pinyin: "Nǐ měitiān jǐ diǎn kāishǐ shàngkè?",
    sentence_vi: "Mỗi ngày bạn bắt đầu học lúc mấy giờ?",
    vocabulary: [
      {
        chinese: "上课",
        pinyin: "shàngkè",
        meaning_vi: "lên lớp, học",
      },
    ],
  },
  "你喜欢听现场音乐会的感觉吗？": {
    sentence_cn: "你喜欢去现场听音乐会吗？",
    sentence_pinyin: "Nǐ xǐhuan qù xiànchǎng tīng yīnyuèhuì ma?",
    sentence_vi: "Bạn có thích đến nghe hòa nhạc trực tiếp không?",
    vocabulary: [
      {
        chinese: "现场",
        pinyin: "xiànchǎng",
        meaning_vi: "trực tiếp, tại chỗ",
      },
      {
        chinese: "音乐会",
        pinyin: "yīnyuèhuì",
        meaning_vi: "buổi hòa nhạc",
      },
    ],
  },
  "你可以帮我扫一下你的微信二维码吗？": {
    sentence_cn: "我可以扫一下你的微信二维码吗？",
    sentence_pinyin: "Wǒ kěyǐ sǎo yíxià nǐ de Wēixìn èrwéimǎ ma?",
    sentence_vi: "Mình có thể quét mã QR WeChat của bạn không?",
    vocabulary: [
      {
        chinese: "扫",
        pinyin: "sǎo",
        meaning_vi: "quét",
      },
      {
        chinese: "二维码",
        pinyin: "èrwéimǎ",
        meaning_vi: "mã QR",
      },
    ],
  },
  "谢谢你，我会经常联系你的。": {
    sentence_cn: "谢谢你，以后我们常联系吧。",
    sentence_pinyin: "Xièxie nǐ, yǐhòu wǒmen cháng liánxì ba.",
    sentence_vi: "Cảm ơn bạn, sau này chúng ta thường xuyên liên lạc nhé.",
    vocabulary: [
      {
        chinese: "联系",
        pinyin: "liánxì",
        meaning_vi: "liên lạc",
      },
    ],
  },
  "请问，我可以给你发一条消息吗？": {
    sentence_vi: "Xin hỏi, mình có thể gửi cho bạn một tin nhắn không?",
  },
  "我已经加了你微信，期待我们的聊天。": {
    sentence_cn: "我已经加了你的微信，期待以后多聊天。",
    sentence_pinyin:
      "Wǒ yǐjīng jiā le nǐ de Wēixìn, qídài yǐhòu duō liáotiān.",
    sentence_vi:
      "Mình đã thêm WeChat của bạn rồi, mong sau này được trò chuyện nhiều hơn.",
    vocabulary: [
      {
        chinese: "期待",
        pinyin: "qídài",
        meaning_vi: "mong đợi",
      },
      {
        chinese: "聊天",
        pinyin: "liáotiān",
        meaning_vi: "trò chuyện",
      },
    ],
  },
  "我们改时间怎么样？我这天有事。": {
    sentence_cn: "我们换个时间怎么样？我那天有事。",
    sentence_pinyin:
      "Wǒmen huàn gè shíjiān zěnmeyàng? Wǒ nà tiān yǒu shì.",
    sentence_vi:
      "Chúng ta đổi sang thời gian khác được không? Hôm đó tôi có việc.",
    vocabulary: [
      {
        chinese: "换个时间",
        pinyin: "huàn gè shíjiān",
        meaning_vi: "đổi sang thời gian khác",
      },
    ],
  },
  "你今天吃饭了吗？我们一起去吧！": {
    sentence_cn: "你吃饭了吗？要不要一起去？",
    sentence_pinyin: "Nǐ chīfàn le ma? Yào bú yào yìqǐ qù?",
    sentence_vi: "Bạn ăn cơm chưa? Có muốn cùng đi không?",
    vocabulary: [
      {
        chinese: "吃饭",
        pinyin: "chīfàn",
        meaning_vi: "ăn cơm",
      },
      {
        chinese: "一起",
        pinyin: "yìqǐ",
        meaning_vi: "cùng nhau",
      },
    ],
  },
  "今天你有什么计划？我们可以一起活动。": {
    sentence_cn: "今天你有什么计划？我们可以一起出去走走。",
    sentence_pinyin:
      "Jīntiān nǐ yǒu shénme jìhuà? Wǒmen kěyǐ yìqǐ chūqù zǒuzou.",
    sentence_vi:
      "Hôm nay bạn có kế hoạch gì? Chúng ta có thể cùng ra ngoài đi dạo.",
    vocabulary: [
      {
        chinese: "计划",
        pinyin: "jìhuà",
        meaning_vi: "kế hoạch",
      },
      {
        chinese: "出去走走",
        pinyin: "chūqù zǒuzou",
        meaning_vi: "ra ngoài đi dạo",
      },
    ],
  },
  "刚才我遇到一个有趣的故事，想和你分享。": {
    sentence_cn: "刚才我听到一个有趣的故事，想和你分享。",
    sentence_pinyin:
      "Gāngcái wǒ tīngdào yí ge yǒuqù de gùshi, xiǎng hé nǐ fēnxiǎng.",
    sentence_vi:
      "Vừa rồi tôi nghe một câu chuyện thú vị và muốn chia sẻ với bạn.",
    vocabulary: [
      {
        chinese: "听到",
        pinyin: "tīngdào",
        meaning_vi: "nghe thấy",
      },
      {
        chinese: "分享",
        pinyin: "fēnxiǎng",
        meaning_vi: "chia sẻ",
      },
    ],
  },
  "我也觉得你的兴趣爱好很有趣。": {
    sentence_cn: "我也觉得你的爱好很有意思。",
    sentence_pinyin: "Wǒ yě juéde nǐ de àihào hěn yǒuyìsi.",
    sentence_vi: "Tôi cũng thấy sở thích của bạn rất thú vị.",
    vocabulary: [
      {
        chinese: "爱好",
        pinyin: "àihào",
        meaning_vi: "sở thích",
      },
      {
        chinese: "有意思",
        pinyin: "yǒuyìsi",
        meaning_vi: "thú vị",
      },
    ],
  },
  "真的吗？你的经验听起来很特别！": {
    sentence_cn: "真的吗？你的经历听起来很特别！",
    sentence_pinyin:
      "Zhēn de ma? Nǐ de jīnglì tīng qǐlái hěn tèbié!",
    sentence_vi: "Thật sao? Trải nghiệm của bạn nghe rất đặc biệt!",
    vocabulary: [
      {
        chinese: "经历",
        pinyin: "jīnglì",
        meaning_vi: "trải nghiệm",
      },
      {
        chinese: "特别",
        pinyin: "tèbié",
        meaning_vi: "đặc biệt",
      },
    ],
  },
  "我也这样想，和你一样有同感。": {
    sentence_cn: "我也这么想，真的很有同感。",
    sentence_pinyin: "Wǒ yě zhème xiǎng, zhēn de hěn yǒu tónggǎn.",
    sentence_vi: "Tôi cũng nghĩ vậy, thực sự rất đồng cảm.",
    vocabulary: [
      {
        chinese: "同感",
        pinyin: "tónggǎn",
        meaning_vi: "sự đồng cảm",
      },
    ],
  },
  "你喜欢这个爱好，真是很棒！": {
    sentence_cn: "这个爱好听起来真不错！",
    sentence_pinyin: "Zhège àihào tīng qǐlái zhēn búcuò!",
    sentence_vi: "Sở thích này nghe thật hay!",
    vocabulary: [
      {
        chinese: "爱好",
        pinyin: "àihào",
        meaning_vi: "sở thích",
      },
      {
        chinese: "不错",
        pinyin: "búcuò",
        meaning_vi: "khá hay, không tệ",
      },
    ],
  },
  "我明白你的意思，非常清楚。": {
    sentence_cn: "我明白你的意思了。",
    sentence_pinyin: "Wǒ míngbai nǐ de yìsi le.",
    sentence_vi: "Tôi hiểu ý bạn rồi.",
    vocabulary: [
      {
        chinese: "明白",
        pinyin: "míngbai",
        meaning_vi: "hiểu",
      },
      {
        chinese: "意思",
        pinyin: "yìsi",
        meaning_vi: "ý, ý nghĩa",
      },
    ],
  },
  "我们下次再见，好吗？期待再聊！": {
    sentence_cn: "我们下次再见吧，期待再聊！",
    sentence_pinyin: "Wǒmen xià cì zàijiàn ba, qídài zài liáo!",
    sentence_vi: "Hẹn lần sau gặp lại nhé, mong được trò chuyện tiếp!",
    vocabulary: [
      {
        chinese: "期待",
        pinyin: "qídài",
        meaning_vi: "mong đợi",
      },
    ],
  },
  "谢谢你的时间，我们保持联系不丢失。": {
    sentence_cn: "谢谢你抽时间来，我们保持联系吧。",
    sentence_pinyin:
      "Xièxie nǐ chōu shíjiān lái, wǒmen bǎochí liánxì ba.",
    sentence_vi:
      "Cảm ơn bạn đã dành thời gian đến đây, chúng ta giữ liên lạc nhé.",
    vocabulary: [
      {
        chinese: "抽时间",
        pinyin: "chōu shíjiān",
        meaning_vi: "dành thời gian",
      },
      {
        chinese: "保持联系",
        pinyin: "bǎochí liánxì",
        meaning_vi: "giữ liên lạc",
      },
    ],
  },
  "朋友们好，再见！祝你们生活愉快。": {
    sentence_cn: "大家再见，祝你们生活愉快！",
    sentence_pinyin: "Dàjiā zàijiàn, zhù nǐmen shēnghuó yúkuài!",
    sentence_vi: "Tạm biệt mọi người, chúc các bạn luôn vui vẻ!",
    vocabulary: [
      {
        chinese: "生活愉快",
        pinyin: "shēnghuó yúkuài",
        meaning_vi: "cuộc sống vui vẻ",
      },
    ],
  },
};
const chinaDailyLifeDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "房间影响邻居安静吗？": {
    sentence_cn: "请问这里的隔音效果怎么样？",
    sentence_pinyin: "Qǐngwèn zhèlǐ de géyīn xiàoguǒ zěnmeyàng?",
    sentence_vi: "Xin hỏi khả năng cách âm ở đây thế nào?",
    vocabulary: [
      {
        chinese: "隔音效果",
        pinyin: "géyīn xiàoguǒ",
        meaning_vi: "khả năng cách âm",
      },
    ],
  },
  "请问您们的缴费截止日期是几号？": {
    sentence_cn: "请问你们的缴费截止日期是几号？",
    sentence_pinyin:
      "Qǐngwèn nǐmen de jiǎofèi jiézhǐ rìqī shì jǐ hào?",
    sentence_vi: "Xin hỏi hạn chót đóng phí là ngày mấy?",
    vocabulary: [
      {
        chinese: "截止日期",
        pinyin: "jiézhǐ rìqī",
        meaning_vi: "hạn chót",
      },
    ],
  },
  "我预约了明天下午两个小时的维修时间。": {
    sentence_cn: "我预约了明天下午两点上门维修。",
    sentence_pinyin:
      "Wǒ yùyuē le míngtiān xiàwǔ liǎng diǎn shàngmén wéixiū.",
    sentence_vi:
      "Tôi đã hẹn thợ đến sửa tại nhà lúc hai giờ chiều mai.",
    vocabulary: [
      {
        chinese: "预约",
        pinyin: "yùyuē",
        meaning_vi: "đặt lịch, hẹn trước",
      },
      {
        chinese: "上门维修",
        pinyin: "shàngmén wéixiū",
        meaning_vi: "đến tận nhà sửa chữa",
      },
    ],
  },
  "修好了空调，请帮我确认一下。": {
    sentence_cn: "空调已经修好了，请帮我确认一下。",
    sentence_pinyin:
      "Kōngtiáo yǐjīng xiū hǎo le, qǐng bāng wǒ quèrèn yíxià.",
    sentence_vi: "Điều hòa đã sửa xong, xin giúp tôi xác nhận lại.",
    vocabulary: [
      {
        chinese: "修好",
        pinyin: "xiū hǎo",
        meaning_vi: "sửa xong",
      },
      {
        chinese: "确认",
        pinyin: "quèrèn",
        meaning_vi: "xác nhận",
      },
    ],
  },
  "您的外卖迟到了，请问还要等多久？": {
    sentence_cn: "我的外卖迟到了，请问还要等多久？",
    sentence_pinyin:
      "Wǒ de wàimài chídào le, qǐngwèn hái yào děng duōjiǔ?",
    sentence_vi:
      "Đồ ăn của tôi bị giao trễ, xin hỏi còn phải đợi bao lâu?",
    vocabulary: [
      {
        chinese: "外卖",
        pinyin: "wàimài",
        meaning_vi: "đồ ăn giao tận nơi",
      },
      {
        chinese: "迟到",
        pinyin: "chídào",
        meaning_vi: "đến muộn, giao trễ",
      },
    ],
  },
  "请问包裹什么时候可以退换？": {
    sentence_cn: "请问这件商品可以退换吗？",
    sentence_pinyin: "Qǐngwèn zhè jiàn shāngpǐn kěyǐ tuìhuàn ma?",
    sentence_vi: "Xin hỏi sản phẩm này có thể đổi trả không?",
    vocabulary: [
      {
        chinese: "商品",
        pinyin: "shāngpǐn",
        meaning_vi: "sản phẩm, hàng hóa",
      },
      {
        chinese: "退换",
        pinyin: "tuìhuàn",
        meaning_vi: "đổi trả",
      },
    ],
  },
  "快递单号是123456，请查收。": {
    sentence_cn: "这是我的快递单号，请帮我查询。",
    sentence_pinyin: "Zhè shì wǒ de kuàidì dānhào, qǐng bāng wǒ cháxún.",
    sentence_vi: "Đây là mã vận đơn của tôi, xin giúp tôi kiểm tra.",
    vocabulary: [
      {
        chinese: "快递单号",
        pinyin: "kuàidì dānhào",
        meaning_vi: "mã vận đơn",
      },
      {
        chinese: "查询",
        pinyin: "cháxún",
        meaning_vi: "tra cứu, kiểm tra",
      },
    ],
  },
  "这件商品想换货，需要多少钱？": {
    sentence_cn: "请问换货需要另外收费吗？",
    sentence_pinyin: "Qǐngwèn huànhuò xūyào lìngwài shōufèi ma?",
    sentence_vi: "Xin hỏi đổi hàng có cần trả thêm phí không?",
    vocabulary: [
      {
        chinese: "换货",
        pinyin: "huànhuò",
        meaning_vi: "đổi hàng",
      },
      {
        chinese: "另外收费",
        pinyin: "lìngwài shōufèi",
        meaning_vi: "thu thêm phí",
      },
    ],
  },
  "我想告诉司机目的地是火车站。": {
    sentence_cn: "师傅，我要去火车站。",
    sentence_pinyin: "Shīfu, wǒ yào qù huǒchēzhàn.",
    sentence_vi: "Bác tài, tôi muốn đến ga tàu hỏa.",
    vocabulary: [
      {
        chinese: "师傅",
        pinyin: "shīfu",
        meaning_vi: "bác tài, cách gọi lịch sự",
      },
      {
        chinese: "火车站",
        pinyin: "huǒchēzhàn",
        meaning_vi: "ga tàu hỏa",
      },
    ],
  },
  "请问拖车电话是多少？": {
    sentence_cn: "请问道路救援电话是多少？",
    sentence_pinyin: "Qǐngwèn dàolù jiùyuán diànhuà shì duōshao?",
    sentence_vi: "Xin hỏi số điện thoại cứu hộ đường bộ là bao nhiêu?",
    vocabulary: [
      {
        chinese: "道路救援",
        pinyin: "dàolù jiùyuán",
        meaning_vi: "cứu hộ đường bộ",
      },
    ],
  },
  "请问附近有几个地铁出口？": {
    sentence_cn: "请问哪个出口离商场最近？",
    sentence_pinyin: "Qǐngwèn nǎge chūkǒu lí shāngchǎng zuì jìn?",
    sentence_vi: "Xin hỏi lối ra nào gần trung tâm mua sắm nhất?",
    vocabulary: [
      {
        chinese: "出口",
        pinyin: "chūkǒu",
        meaning_vi: "lối ra",
      },
      {
        chinese: "商场",
        pinyin: "shāngchǎng",
        meaning_vi: "trung tâm mua sắm",
      },
    ],
  },
  "我发给你我的位置，可以方便你来找我。": {
    sentence_cn: "我把位置发给你，这样你更容易找到我。",
    sentence_pinyin:
      "Wǒ bǎ wèizhì fā gěi nǐ, zhèyàng nǐ gèng róngyì zhǎodào wǒ.",
    sentence_vi: "Tôi gửi vị trí cho bạn để bạn dễ tìm thấy tôi hơn.",
    vocabulary: [
      {
        chinese: "位置",
        pinyin: "wèizhì",
        meaning_vi: "vị trí",
      },
      {
        chinese: "容易",
        pinyin: "róngyì",
        meaning_vi: "dễ dàng",
      },
    ],
  },
  "我用微信支付买了二十块的东西。": {
    sentence_cn: "我用微信支付买了二十块钱的东西。",
    sentence_pinyin:
      "Wǒ yòng Wēixìn Zhīfù mǎi le èrshí kuài qián de dōngxi.",
    sentence_vi:
      "Tôi đã dùng WeChat Pay mua món đồ trị giá hai mươi tệ.",
    vocabulary: [
      {
        chinese: "微信支付",
        pinyin: "Wēixìn Zhīfù",
        meaning_vi: "thanh toán WeChat",
      },
    ],
  },
  "微信里的群聊消息非常多，如何关闭？": {
    sentence_cn: "群聊消息太多了，我可以设置免打扰吗？",
    sentence_pinyin:
      "Qúnliáo xiāoxi tài duō le, wǒ kěyǐ shèzhì miǎn dǎrǎo ma?",
    sentence_vi:
      "Tin nhắn nhóm quá nhiều, tôi có thể bật chế độ không làm phiền không?",
    vocabulary: [
      {
        chinese: "群聊消息",
        pinyin: "qúnliáo xiāoxi",
        meaning_vi: "tin nhắn nhóm",
      },
      {
        chinese: "免打扰",
        pinyin: "miǎn dǎrǎo",
        meaning_vi: "không làm phiền",
      },
    ],
  },
  "你们这里最近有卖退烧药吗？": {
    sentence_cn: "请问你们这里有退烧药吗？",
    sentence_pinyin: "Qǐngwèn nǐmen zhèlǐ yǒu tuìshāoyào ma?",
    sentence_vi: "Xin hỏi ở đây có thuốc hạ sốt không?",
    vocabulary: [
      {
        chinese: "退烧药",
        pinyin: "tuìshāoyào",
        meaning_vi: "thuốc hạ sốt",
      },
    ],
  },
  "我想预约明天下午理发时间。": {
    sentence_cn: "我想预约明天下午理发。",
    sentence_pinyin: "Wǒ xiǎng yùyuē míngtiān xiàwǔ lǐfà.",
    sentence_vi: "Tôi muốn đặt lịch cắt tóc vào chiều mai.",
    vocabulary: [
      {
        chinese: "预约",
        pinyin: "yùyuē",
        meaning_vi: "đặt lịch",
      },
      {
        chinese: "理发",
        pinyin: "lǐfà",
        meaning_vi: "cắt tóc",
      },
    ],
  },
  "我需要寄一个包裹，请问在哪儿？": {
    sentence_cn: "我需要寄一个包裹，请问去哪里办理？",
    sentence_pinyin: "Wǒ xūyào jì yí ge bāoguǒ, qǐngwèn qù nǎlǐ bànlǐ?",
    sentence_vi: "Tôi cần gửi một bưu kiện, xin hỏi phải đến đâu làm thủ tục?",
    vocabulary: [
      {
        chinese: "包裹",
        pinyin: "bāoguǒ",
        meaning_vi: "bưu kiện",
      },
      {
        chinese: "办理",
        pinyin: "bànlǐ",
        meaning_vi: "làm thủ tục",
      },
    ],
  },
  "我昨天丢了钱包，请问应该怎么办？": {
    sentence_cn: "我昨天把钱包弄丢了，请问应该怎么办？",
    sentence_pinyin:
      "Wǒ zuótiān bǎ qiánbāo nòng diū le, qǐngwèn yīnggāi zěnme bàn?",
    sentence_vi: "Hôm qua tôi làm mất ví, xin hỏi tôi nên làm gì?",
    vocabulary: [
      {
        chinese: "弄丢",
        pinyin: "nòng diū",
        meaning_vi: "làm mất",
      },
      {
        chinese: "怎么办",
        pinyin: "zěnme bàn",
        meaning_vi: "làm thế nào",
      },
    ],
  },
  "我的护照找不到了，您能帮我吗？": {
    sentence_cn: "我的护照不见了，您能帮我吗？",
    sentence_pinyin: "Wǒ de hùzhào bú jiàn le, nín néng bāng wǒ ma?",
    sentence_vi: "Hộ chiếu của tôi bị mất rồi, ông/bà có thể giúp tôi không?",
    vocabulary: [
      {
        chinese: "护照",
        pinyin: "hùzhào",
        meaning_vi: "hộ chiếu",
      },
      {
        chinese: "不见",
        pinyin: "bú jiàn",
        meaning_vi: "biến mất, không thấy",
      },
    ],
  },
  "请问，附近最近的派出所在哪里？": {
    sentence_cn: "请问最近的派出所在哪里？",
    sentence_pinyin: "Qǐngwèn zuìjìn de pàichūsuǒ zài nǎlǐ?",
    sentence_vi: "Xin hỏi đồn cảnh sát gần nhất ở đâu?",
    vocabulary: [
      {
        chinese: "派出所",
        pinyin: "pàichūsuǒ",
        meaning_vi: "đồn cảnh sát",
      },
    ],
  },
  "您好，可以请邻居帮忙照看一下门吗？": {
    sentence_cn: "我不在家时，可以请邻居帮忙收快递吗？",
    sentence_pinyin:
      "Wǒ bú zài jiā shí, kěyǐ qǐng línjū bāngmáng shōu kuàidì ma?",
    sentence_vi:
      "Khi tôi không ở nhà, có thể nhờ hàng xóm nhận hàng giúp không?",
    vocabulary: [
      {
        chinese: "邻居",
        pinyin: "línjū",
        meaning_vi: "hàng xóm",
      },
      {
        chinese: "收快递",
        pinyin: "shōu kuàidì",
        meaning_vi: "nhận hàng giao",
      },
    ],
  },
};
const travelAirportDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "请问候机楼在哪里？": {
    sentence_vi: "Xin hỏi nhà ga sân bay ở đâu?",
  },
  "飞机几点开始登机？": {
    sentence_vi: "Việc lên máy bay bắt đầu lúc mấy giờ?",
  },
  "请问更改登机口在哪里？": {
    sentence_cn: "请问新的登机口在哪里？",
    sentence_pinyin: "Qǐngwèn xīn de dēngjīkǒu zài nǎlǐ?",
    sentence_vi: "Xin hỏi cửa ra máy bay mới ở đâu?",
    vocabulary: [
      {
        chinese: "登机口",
        pinyin: "dēngjīkǒu",
        meaning_vi: "cửa ra máy bay",
      },
    ],
  },
  "请帮我更换登机时间。": {
    sentence_cn: "请帮我改签到其他航班。",
    sentence_pinyin: "Qǐng bāng wǒ gǎiqiān dào qítā hángbān.",
    sentence_vi: "Xin giúp tôi đổi sang chuyến bay khác.",
    vocabulary: [
      {
        chinese: "改签",
        pinyin: "gǎiqiān",
        meaning_vi: "đổi chuyến",
      },
      {
        chinese: "航班",
        pinyin: "hángbān",
        meaning_vi: "chuyến bay",
      },
    ],
  },
  "请问护照专用通道在哪里？": {
    sentence_cn: "请问外国护照通道在哪里？",
    sentence_pinyin: "Qǐngwèn wàiguó hùzhào tōngdào zài nǎlǐ?",
    sentence_vi: "Xin hỏi làn dành cho hộ chiếu nước ngoài ở đâu?",
    vocabulary: [
      {
        chinese: "外国护照",
        pinyin: "wàiguó hùzhào",
        meaning_vi: "hộ chiếu nước ngoài",
      },
      {
        chinese: "通道",
        pinyin: "tōngdào",
        meaning_vi: "làn đi",
      },
    ],
  },
  "这是我的护照和有效签证，请查收。": {
    sentence_cn: "这是我的护照和有效签证，请查验。",
    sentence_pinyin:
      "Zhè shì wǒ de hùzhào hé yǒuxiào qiānzhèng, qǐng cháyàn.",
    sentence_vi:
      "Đây là hộ chiếu và thị thực còn hiệu lực của tôi, xin kiểm tra.",
    vocabulary: [
      {
        chinese: "有效签证",
        pinyin: "yǒuxiào qiānzhèng",
        meaning_vi: "thị thực còn hiệu lực",
      },
      {
        chinese: "查验",
        pinyin: "cháyàn",
        meaning_vi: "kiểm tra",
      },
    ],
  },
  "请问红色通道是专门申报贵重物品的吗？": {
    sentence_cn: "请问需要申报的物品要走红色通道吗？",
    sentence_pinyin:
      "Qǐngwèn xūyào shēnbào de wùpǐn yào zǒu hóngsè tōngdào ma?",
    sentence_vi:
      "Xin hỏi hàng hóa cần khai báo có phải đi qua làn đỏ không?",
    vocabulary: [
      {
        chinese: "申报",
        pinyin: "shēnbào",
        meaning_vi: "khai báo",
      },
      {
        chinese: "红色通道",
        pinyin: "hóngsè tōngdào",
        meaning_vi: "làn đỏ",
      },
    ],
  },
  "请问领取入境章盖章处在哪里？": {
    sentence_cn: "请问在哪里盖入境章？",
    sentence_pinyin: "Qǐngwèn zài nǎlǐ gài rùjìngzhāng?",
    sentence_vi: "Xin hỏi đóng dấu nhập cảnh ở đâu?",
    vocabulary: [
      {
        chinese: "入境章",
        pinyin: "rùjìngzhāng",
        meaning_vi: "dấu nhập cảnh",
      },
    ],
  },
  "我在海关申报了需要申报的物品。": {
    sentence_cn: "我已经向海关申报了这些物品。",
    sentence_pinyin: "Wǒ yǐjīng xiàng hǎiguān shēnbào le zhèxiē wùpǐn.",
    sentence_vi: "Tôi đã khai báo những hàng hóa này với hải quan.",
    vocabulary: [
      {
        chinese: "海关",
        pinyin: "hǎiguān",
        meaning_vi: "hải quan",
      },
      {
        chinese: "申报",
        pinyin: "shēnbào",
        meaning_vi: "khai báo",
      },
    ],
  },
  "我的行李箱颜色是黑色，形状是硬壳的。": {
    sentence_cn: "我的行李箱是黑色的硬壳箱。",
    sentence_pinyin: "Wǒ de xínglixiāng shì hēisè de yìngké xiāng.",
    sentence_vi: "Vali của tôi là loại vỏ cứng màu đen.",
    vocabulary: [
      {
        chinese: "硬壳箱",
        pinyin: "yìngké xiāng",
        meaning_vi: "vali vỏ cứng",
      },
    ],
  },
  "我行李的箱子是红色的，比较大。": {
    sentence_cn: "我的行李箱是红色的，尺寸比较大。",
    sentence_pinyin:
      "Wǒ de xínglixiāng shì hóngsè de, chǐcùn bǐjiào dà.",
    sentence_vi: "Vali của tôi màu đỏ và có kích thước khá lớn.",
    vocabulary: [
      {
        chinese: "尺寸",
        pinyin: "chǐcùn",
        meaning_vi: "kích thước",
      },
    ],
  },
  "我的托运行李是否可以带上这件礼物？": {
    sentence_cn: "这件礼物可以放在托运行李里吗？",
    sentence_pinyin: "Zhè jiàn lǐwù kěyǐ fàng zài tuōyùn xínglǐ lǐ ma?",
    sentence_vi: "Món quà này có thể để trong hành lý ký gửi không?",
    vocabulary: [
      {
        chinese: "托运行李",
        pinyin: "tuōyùn xínglǐ",
        meaning_vi: "hành lý ký gửi",
      },
    ],
  },
  "请司机去这个地址，谢谢。": {
    sentence_cn: "请送我到这个地址，谢谢。",
    sentence_pinyin: "Qǐng sòng wǒ dào zhège dìzhǐ, xièxie.",
    sentence_vi: "Xin hãy đưa tôi đến địa chỉ này, cảm ơn.",
    vocabulary: [
      {
        chinese: "地址",
        pinyin: "dìzhǐ",
        meaning_vi: "địa chỉ",
      },
    ],
  },
  "请问出租车有计价表吗？": {
    sentence_cn: "请问出租车有计价器吗？",
    sentence_pinyin: "Qǐngwèn chūzūchē yǒu jìjiàqì ma?",
    sentence_vi: "Xin hỏi taxi có đồng hồ tính cước không?",
    vocabulary: [
      {
        chinese: "计价器",
        pinyin: "jìjiàqì",
        meaning_vi: "đồng hồ tính cước",
      },
    ],
  },
  "请在这里帮我停车，谢谢。": {
    sentence_cn: "请在这里停车，谢谢。",
    sentence_pinyin: "Qǐng zài zhèlǐ tíngchē, xièxie.",
    sentence_vi: "Xin hãy dừng xe tại đây, cảm ơn.",
    vocabulary: [
      {
        chinese: "停车",
        pinyin: "tíngchē",
        meaning_vi: "dừng xe",
      },
    ],
  },
  "到目的地大概要多长时间？": {
    sentence_vi: "Đến nơi mất khoảng bao lâu?",
  },
  "请问在哪儿可以租借汽车？": {
    sentence_cn: "请问在哪儿可以租车？",
    sentence_pinyin: "Qǐngwèn zài nǎr kěyǐ zūchē?",
    sentence_vi: "Xin hỏi có thể thuê xe ở đâu?",
    vocabulary: [
      {
        chinese: "租车",
        pinyin: "zūchē",
        meaning_vi: "thuê xe",
      },
    ],
  },
  "这趟公交车几号线？": {
    sentence_cn: "这是几路公交车？",
    sentence_pinyin: "Zhè shì jǐ lù gōngjiāochē?",
    sentence_vi: "Đây là xe buýt tuyến số mấy?",
    vocabulary: [
      {
        chinese: "几路",
        pinyin: "jǐ lù",
        meaning_vi: "tuyến số mấy",
      },
    ],
  },
  "这辆出租车是我的顺风车吗？": {
    sentence_cn: "这是我预约的网约车吗？",
    sentence_pinyin: "Zhè shì wǒ yùyuē de wǎngyuēchē ma?",
    sentence_vi: "Đây có phải là xe tôi đã đặt qua ứng dụng không?",
    vocabulary: [
      {
        chinese: "预约",
        pinyin: "yùyuē",
        meaning_vi: "đặt trước",
      },
      {
        chinese: "网约车",
        pinyin: "wǎngyuēchē",
        meaning_vi: "xe đặt qua ứng dụng",
      },
    ],
  },
  "附近很吵，能换个更安静的房间吗？": {
    sentence_cn: "外面太吵了，能换一个更安静的房间吗？",
    sentence_pinyin:
      "Wàimiàn tài chǎo le, néng huàn yí ge gèng ānjìng de fángjiān ma?",
    sentence_vi: "Bên ngoài quá ồn, tôi có thể đổi sang phòng yên tĩnh hơn không?",
    vocabulary: [
      {
        chinese: "安静",
        pinyin: "ānjìng",
        meaning_vi: "yên tĩnh",
      },
      {
        chinese: "换",
        pinyin: "huàn",
        meaning_vi: "đổi",
      },
    ],
  },
  "请告诉我附近有没有餐厅推荐？": {
    sentence_cn: "请问附近有推荐的餐厅吗？",
    sentence_pinyin: "Qǐngwèn fùjìn yǒu tuījiàn de cāntīng ma?",
    sentence_vi: "Xin hỏi gần đây có nhà hàng nào được đề xuất không?",
    vocabulary: [
      {
        chinese: "推荐",
        pinyin: "tuījiàn",
        meaning_vi: "đề xuất",
      },
      {
        chinese: "餐厅",
        pinyin: "cāntīng",
        meaning_vi: "nhà hàng",
      },
    ],
  },
  "请帮我预订明天早上的机场接送服务。": {
    sentence_vi: "Xin giúp tôi đặt dịch vụ đưa đón sân bay vào sáng mai.",
  },
  "房间附近有停车场吗？": {
    sentence_cn: "酒店附近有停车场吗？",
    sentence_pinyin: "Jiǔdiàn fùjìn yǒu tíngchēchǎng ma?",
    sentence_vi: "Gần khách sạn có bãi đỗ xe không?",
    vocabulary: [
      {
        chinese: "停车场",
        pinyin: "tíngchēchǎng",
        meaning_vi: "bãi đỗ xe",
      },
    ],
  },
  "我需要联系中国大使馆，能帮忙吗？": {
    sentence_cn: "我需要联系本国大使馆，能帮忙吗？",
    sentence_pinyin: "Wǒ xūyào liánxì běnguó dàshǐguǎn, néng bāngmáng ma?",
    sentence_vi:
      "Tôi cần liên hệ đại sứ quán nước mình, bạn có thể giúp không?",
    vocabulary: [
      {
        chinese: "本国",
        pinyin: "běnguó",
        meaning_vi: "nước mình",
      },
      {
        chinese: "大使馆",
        pinyin: "dàshǐguǎn",
        meaning_vi: "đại sứ quán",
      },
    ],
  },
  "旅险号码是这个，请帮我联系保险公司。": {
    sentence_cn: "我的旅游保险单号在这里，请帮我联系保险公司。",
    sentence_pinyin:
      "Wǒ de lǚyóu bǎoxiǎn dānhào zài zhèlǐ, qǐng bāng wǒ liánxì bǎoxiǎn gōngsī.",
    sentence_vi:
      "Mã hợp đồng bảo hiểm du lịch của tôi ở đây, xin giúp tôi liên hệ công ty bảo hiểm.",
    vocabulary: [
      {
        chinese: "保险单号",
        pinyin: "bǎoxiǎn dānhào",
        meaning_vi: "mã hợp đồng bảo hiểm",
      },
      {
        chinese: "保险公司",
        pinyin: "bǎoxiǎn gōngsī",
        meaning_vi: "công ty bảo hiểm",
      },
    ],
  },
  "我的手机被偷了，有人报警了吗？": {
    sentence_cn: "我的手机被偷了，请帮我报警。",
    sentence_pinyin: "Wǒ de shǒujī bèi tōu le, qǐng bāng wǒ bàojǐng.",
    sentence_vi: "Điện thoại của tôi bị lấy cắp, xin giúp tôi báo cảnh sát.",
    vocabulary: [
      {
        chinese: "被偷",
        pinyin: "bèi tōu",
        meaning_vi: "bị lấy cắp",
      },
      {
        chinese: "报警",
        pinyin: "bàojǐng",
        meaning_vi: "báo cảnh sát",
      },
    ],
  },
  "我找不到月台，能帮我指路吗？": {
    sentence_vi: "Tôi không tìm thấy sân ga, bạn có thể chỉ đường không?",
  },
  "我需要马上去医院，有紧急情况。": {
    sentence_cn: "我需要马上去医院，这是紧急情况。",
    sentence_pinyin: "Wǒ xūyào mǎshàng qù yīyuàn, zhè shì jǐnjí qíngkuàng.",
    sentence_vi: "Tôi cần đến bệnh viện ngay, đây là tình huống khẩn cấp.",
    vocabulary: [
      {
        chinese: "紧急情况",
        pinyin: "jǐnjí qíngkuàng",
        meaning_vi: "tình huống khẩn cấp",
      },
    ],
  },
};
const salesCustomerServiceDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "我们的产品保证原产地是国内知名工厂制造。": {
    sentence_cn: "产品标签上清楚标明了原产地和生产厂家。",
    sentence_pinyin:
      "Chǎnpǐn biāoqiān shàng qīngchu biāomíng le yuánchǎndì hé shēngchǎn chǎngjiā.",
    sentence_vi:
      "Nhãn sản phẩm ghi rõ xuất xứ và nhà sản xuất.",
    vocabulary: [
      {
        chinese: "原产地",
        pinyin: "yuánchǎndì",
        meaning_vi: "xuất xứ",
      },
      {
        chinese: "生产厂家",
        pinyin: "shēngchǎn chǎngjiā",
        meaning_vi: "nhà sản xuất",
      },
    ],
  },
  "预付款需在发货前完成，感谢您的配合。": {
    sentence_vi:
      "Khoản trả trước cần được thanh toán trước khi giao hàng, cảm ơn quý khách hợp tác.",
    vocabulary: [
      {
        chinese: "预付款",
        pinyin: "yùfùkuǎn",
        meaning_vi: "khoản trả trước",
      },
      {
        chinese: "配合",
        pinyin: "pèihé",
        meaning_vi: "hợp tác",
      },
    ],
  },
  "恭喜您，您的订单已成功签收，祝您使用愉快。": {
    sentence_cn: "您的订单已成功签收，感谢您的支持，祝您使用愉快。",
    sentence_pinyin:
      "Nín de dìngdān yǐ chénggōng qiānshōu, gǎnxiè nín de zhīchí, zhù nín shǐyòng yúkuài.",
    sentence_vi:
      "Đơn hàng đã được ký nhận thành công, cảm ơn quý khách ủng hộ và chúc quý khách sử dụng sản phẩm vui vẻ.",
    vocabulary: [
      {
        chinese: "签收",
        pinyin: "qiānshōu",
        meaning_vi: "ký nhận hàng",
      },
      {
        chinese: "愉快",
        pinyin: "yúkuài",
        meaning_vi: "vui vẻ, thoải mái",
      },
    ],
  },
  "我们确认您收到的订单与发货内容是否一致。": {
    sentence_cn: "请您确认收到的商品与订单内容是否一致。",
    sentence_pinyin:
      "Qǐng nín quèrèn shōudào de shāngpǐn yǔ dìngdān nèiróng shìfǒu yízhì.",
    sentence_vi:
      "Xin quý khách xác nhận sản phẩm đã nhận có đúng với nội dung đơn hàng hay không.",
    vocabulary: [
      {
        chinese: "确认",
        pinyin: "quèrèn",
        meaning_vi: "xác nhận",
      },
      {
        chinese: "内容",
        pinyin: "nèiróng",
        meaning_vi: "nội dung",
      },
    ],
  },
};
const logisticsImportExportDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "请提供贵公司的产品供应商名单供我们参考。": {
    sentence_cn: "请提供贵公司的产品目录供我们参考。",
    sentence_pinyin:
      "Qǐng tígōng guì gōngsī de chǎnpǐn mùlù gōng wǒmen cānkǎo.",
    sentence_vi:
      "Vui lòng cung cấp danh mục sản phẩm của quý công ty để chúng tôi tham khảo.",
    vocabulary: [
      {
        chinese: "产品目录",
        pinyin: "chǎnpǐn mùlù",
        meaning_vi: "danh mục sản phẩm",
      },
    ],
  },
  "我们计划订购的数量是五千件，请确认是否可行。": {
    sentence_cn: "请确认我们计划订购的数量是否可以按期供应。",
    sentence_pinyin:
      "Qǐng quèrèn wǒmen jìhuà dìnggòu de shùliàng shìfǒu kěyǐ ànqī gōngyìng.",
    sentence_vi:
      "Vui lòng xác nhận số lượng chúng tôi dự kiến đặt có thể được cung ứng đúng hạn hay không.",
    vocabulary: [
      {
        chinese: "按期供应",
        pinyin: "ànqī gōngyìng",
        meaning_vi: "cung ứng đúng hạn",
      },
    ],
  },
  "请提供贵方的质量检验报告以便我们审核。": {
    sentence_vi:
      "Xin cung cấp báo cáo kiểm tra chất lượng của quý công ty để chúng tôi rà soát.",
  },
  "请及时通知我们航运的最新动态和到港时间。": {
    sentence_vi:
      "Vui lòng thông báo kịp thời cho chúng tôi thông tin vận tải đường biển mới nhất và thời gian đến cảng.",
  },
  "收到运输异常信息，烦请提供详细整改时间表。": {
    sentence_pinyin:
      "Shōudào yùnshū yìcháng xìnxī, fánqǐng tígōng xiángxì zhěnggǎi shíjiānbiǎo.",
    sentence_vi:
      "Đã nhận thông tin vận chuyển bất thường, vui lòng cung cấp tiến độ khắc phục chi tiết.",
    vocabulary: [
      {
        chinese: "运输异常",
        pinyin: "yùnshū yìcháng",
        meaning_vi: "sự cố vận chuyển",
      },
      {
        chinese: "整改时间表",
        pinyin: "zhěnggǎi shíjiānbiǎo",
        meaning_vi: "tiến độ khắc phục",
      },
    ],
  },
};
const commercialContractNegotiationDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "双方签署的对账确认书具有法律效力。": {
    sentence_cn: "请确认双方是否需要签署对账确认书。",
    sentence_pinyin:
      "Qǐng quèrèn shuāngfāng shìfǒu xūyào qiānshǔ duìzhàng quèrènshū.",
    sentence_vi:
      "Vui lòng xác nhận hai bên có cần ký biên bản đối soát hay không.",
    vocabulary: [
      {
        chinese: "对账确认书",
        pinyin: "duìzhàng quèrènshū",
        meaning_vi: "biên bản xác nhận đối soát",
      },
    ],
  },
};
const workCallsMessagesDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "您方便给我介绍一下您的背景吗？": {
    sentence_cn: "方便说明一下您负责的业务吗？",
    sentence_pinyin: "Fāngbiàn shuōmíng yíxià nín fùzé de yèwù ma?",
    sentence_vi:
      "Anh/chị có tiện cho biết mình phụ trách mảng công việc nào không?",
    vocabulary: [
      {
        chinese: "负责的业务",
        pinyin: "fùzé de yèwù",
        meaning_vi: "mảng công việc phụ trách",
      },
    ],
  },
  "请确认，我已经将您的信息转达了。": {
    sentence_cn: "您的信息我已经转达给相关同事了。",
    sentence_pinyin:
      "Nín de xìnxī wǒ yǐjīng zhuǎndá gěi xiāngguān tóngshì le.",
    sentence_vi:
      "Tôi đã chuyển thông tin của anh/chị cho đồng nghiệp phụ trách.",
    vocabulary: [
      {
        chinese: "转达",
        pinyin: "zhuǎndá",
        meaning_vi: "chuyển lời, truyền đạt",
      },
    ],
  },
  "请问您找的同事现在正在开会。": {
    sentence_cn: "您要找的同事现在正在开会。",
    sentence_pinyin:
      "Nín yào zhǎo de tóngshì xiànzài zhèngzài kāihuì.",
    sentence_vi: "Đồng nghiệp anh/chị cần gặp hiện đang họp.",
    vocabulary: [
      {
        chinese: "正在开会",
        pinyin: "zhèngzài kāihuì",
        meaning_vi: "đang họp",
      },
    ],
  },
  "请问确认订单数量必须是多少？": {
    sentence_cn: "请问您需要确认的订单数量是多少？",
    sentence_pinyin:
      "Qǐngwèn nín xūyào quèrèn de dìngdān shùliàng shì duōshao?",
    sentence_vi:
      "Xin hỏi số lượng đơn hàng anh/chị cần xác nhận là bao nhiêu?",
    vocabulary: [
      {
        chinese: "订单数量",
        pinyin: "dìngdān shùliàng",
        meaning_vi: "số lượng đơn hàng",
      },
    ],
  },
  "您好，我是市场部的张先生。": {
    sentence_cn: "您好，我是这个项目的联络人。",
    sentence_pinyin: "Nínhǎo, wǒ shì zhège xiàngmù de liánluòrén.",
    sentence_vi: "Xin chào, tôi là người liên hệ của dự án này.",
    vocabulary: [
      {
        chinese: "联络人",
        pinyin: "liánluòrén",
        meaning_vi: "người liên hệ",
      },
    ],
  },
  "信号有点弱，您能稍微靠近手机吗？": {
    sentence_cn: "信号有点弱，您能换到信号好一点的位置吗？",
    sentence_pinyin:
      "Xìnhào yǒudiǎn ruò, nín néng huàn dào xìnhào hǎo yìdiǎn de wèizhì ma?",
    sentence_vi:
      "Tín hiệu hơi yếu, anh/chị có thể chuyển sang chỗ có tín hiệu tốt hơn không?",
    vocabulary: [
      {
        chinese: "信号",
        pinyin: "xìnhào",
        meaning_vi: "tín hiệu",
      },
    ],
  },
  "对不起，刚才电话好像没接通，我们再拨一次。": {
    sentence_cn: "对不起，刚才电话断了，我们重新联系一下。",
    sentence_pinyin:
      "Duìbuqǐ, gāngcái diànhuà duàn le, wǒmen chóngxīn liánxì yíxià.",
    sentence_vi:
      "Xin lỗi, cuộc gọi vừa bị ngắt, chúng ta kết nối lại nhé.",
    vocabulary: [
      {
        chinese: "重新联系",
        pinyin: "chóngxīn liánxì",
        meaning_vi: "liên hệ lại",
      },
    ],
  },
};

const dataCorrections = isFactoryTemplate
  ? factoryDataCorrections
  : isFriendshipTemplate
    ? friendshipDataCorrections
    : isChinaDailyLifeTemplate
      ? chinaDailyLifeDataCorrections
      : isTravelAirportTemplate
        ? travelAirportDataCorrections
        : isSalesCustomerServiceTemplate
          ? salesCustomerServiceDataCorrections
          : isLogisticsImportExportTemplate
            ? logisticsImportExportDataCorrections
            : isCommercialContractNegotiationTemplate
              ? commercialContractNegotiationDataCorrections
              : isWorkCallsMessagesTemplate
                ? workCallsMessagesDataCorrections
                : officeDataCorrections;

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function hasToneMark(value: string) {
  return /[\u0300\u0301\u0304\u030c]/u.test(value.normalize("NFD"));
}

function hasVietnameseAccent(value: string) {
  return (
    /[\u0300-\u036f]/u.test(value.normalize("NFD")) ||
    /[\u0110\u0111]/u.test(value)
  );
}

function stripFormatting(value: string) {
  return value
    .replaceAll("**", "")
    .replaceAll("__", "")
    .replace(/[【】\[\]]/gu, " ")
    .trim();
}

function normalizeHighlight(word: HighlightWord): HighlightWord {
  return {
    chinese: stripFormatting(word.chinese).replace(/\s+/g, ""),
    pinyin: stripFormatting(word.pinyin).replace(/\s+/g, " "),
    meaning_vi: stripFormatting(word.meaning_vi),
  };
}

function normalizeSentence(card: GeneratedSentence): GeneratedSentence {
  const normalized = {
    category: stripFormatting(card.category),
    sentence_cn: stripFormatting(card.sentence_cn).replace(/\s+/g, ""),
    sentence_pinyin: stripFormatting(card.sentence_pinyin).replace(
      /\s+/g,
      " ",
    ),
    sentence_vi: stripFormatting(card.sentence_vi),
    vocabulary: card.vocabulary.map(normalizeHighlight),
  };
  return {
    ...normalized,
    ...dataCorrections[normalized.sentence_cn],
  };
}

function rejectionReason(
  card: GeneratedSentence,
  forbiddenSentences: Set<string>,
  collectedSentences: Set<string>,
) {
  if (forbiddenSentences.has(card.sentence_cn)) {
    return "câu đã xuất hiện ở nhóm khác";
  }
  if (collectedSentences.has(card.sentence_cn)) {
    return "câu bị trùng trong nhóm";
  }
  if (!/[\u3002\uff01\uff1f]$/u.test(card.sentence_cn)) {
    return "câu tiếng Trung thiếu dấu câu";
  }
  if (!hasToneMark(card.sentence_pinyin)) {
    return "pinyin của câu chưa có dấu thanh";
  }
  if (!hasVietnameseAccent(card.sentence_vi)) {
    return "nghĩa tiếng Việt chưa có dấu";
  }
  if (
    card.vocabulary.length < 1 ||
    card.vocabulary.length > maxHighlightWords
  ) {
    return `mỗi câu phải có từ một đến ${maxHighlightWords} từ mới`;
  }

  const seenWords = new Set<string>();
  for (const word of card.vocabulary) {
    if (seenWords.has(word.chinese)) {
      return "từ highlight bị trùng trong cùng câu";
    }
    if (!card.sentence_cn.includes(word.chinese)) {
      return `từ highlight ${word.chinese} không có trong câu`;
    }
    if (!hasToneMark(word.pinyin)) {
      return `pinyin của từ ${word.chinese} chưa có dấu thanh`;
    }
    if (!hasVietnameseAccent(word.meaning_vi)) {
      return `nghĩa của từ ${word.chinese} chưa có dấu`;
    }
    seenWords.add(word.chinese);
  }
  return null;
}

function validateCategory(
  spec: CategorySpec,
  cards: GeneratedSentence[],
  excludedSentences: Set<string>,
) {
  if (cards.length !== spec.count) {
    throw new Error(
      `${spec.name}: cần ${spec.count} câu, hiện có ${cards.length}.`,
    );
  }

  const normalized = cards.map((card) => ({
    ...normalizeSentence(card),
    category: spec.id,
  }));
  const collectedSentences = new Set<string>();
  for (const card of normalized) {
    const reason = rejectionReason(
      card,
      excludedSentences,
      collectedSentences,
    );
    if (reason) {
      throw new Error(`${spec.name} - ${card.sentence_cn}: ${reason}.`);
    }
    collectedSentences.add(card.sentence_cn);
  }
  return normalized;
}

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return [] satisfies GeneratedSentence[];
  }
  const parsed = responseSchema.parse(
    JSON.parse(fs.readFileSync(cachePath, "utf8")),
  );
  return parsed.items.map(normalizeSentence);
}

function saveCache(cards: GeneratedSentence[]) {
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ items: cards }, null, 2),
    "utf8",
  );
}

async function generateCategory(
  openai: OpenAI,
  spec: CategorySpec,
  excludedSentences: string[],
) {
  const collected = new Map<string, GeneratedSentence>();
  const forbiddenSentences = new Set(excludedSentences);

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const remaining = spec.count - collected.size;
    if (remaining <= 0) {
      break;
    }

    const requestCount = remaining <= 5 ? 6 : Math.min(remaining + 3, 28);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: isFactoryTemplate
            ? "factory_situational_sentences"
            : isFriendshipTemplate
              ? "friendship_situational_sentences"
              : isChinaDailyLifeTemplate
                ? "china_daily_life_sentences"
                : isTravelAirportTemplate
                  ? "travel_airport_sentences"
                  : isSalesCustomerServiceTemplate
                    ? "sales_customer_service_sentences"
                    : isLogisticsImportExportTemplate
                      ? "logistics_import_export_sentences"
                      : isCommercialContractNegotiationTemplate
                        ? "commercial_contract_negotiation_sentences"
                        : isWorkCallsMessagesTemplate
                          ? "work_calls_messages_sentences"
                          : "office_communication_sentences",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items"],
            properties: {
              items: {
                type: "array",
                minItems: requestCount,
                maxItems: requestCount,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "category",
                    "sentence_cn",
                    "sentence_pinyin",
                    "sentence_vi",
                    "vocabulary",
                  ],
                  properties: {
                    category: { type: "string" },
                    sentence_cn: { type: "string" },
                    sentence_pinyin: { type: "string" },
                    sentence_vi: { type: "string" },
                    vocabulary: {
                      type: "array",
                      minItems: 1,
                      maxItems: maxHighlightWords,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["chinese", "pinyin", "meaning_vi"],
                        properties: {
                          chinese: { type: "string" },
                          pinyin: { type: "string" },
                          meaning_vi: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: isFactoryTemplate
            ? "Bạn là giáo viên tiếng Trung chuyên ngành nhà máy và xưởng sản xuất cho người Việt đi làm. Hãy tạo các câu tiếng Trung giản thể tự nhiên, chính xác và thực tế mà công nhân, tổ trưởng, kỹ thuật viên và nhân viên chất lượng thường dùng. Ưu tiên cách nói rõ ràng, dễ áp dụng tại hiện trường; không tạo khẩu hiệu chung chung và không đưa hướng dẫn nguy hiểm trái quy trình. Câu phải dài khoảng 8-30 chữ Hán, diễn đạt trọn ý, không dùng tên người hay tên công ty cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới, chữ viết tắt tiếng Anh hoặc ký hiệu định dạng vào câu. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và dùng đúng thuật ngữ sản xuất. Mỗi câu chọn 1-3 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ đó phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
            : isFriendshipTemplate
              ? "Bạn là giáo viên tiếng Trung giao tiếp cho người Việt muốn làm quen và kết bạn. Hãy tạo các câu tiếng Trung giản thể tự nhiên, thân thiện, lịch sự và thực tế, phù hợp trình độ HSK1-HSK3. Bao quát chào hỏi, giới thiệu bản thân, quê quán, công việc, sở thích, học ngôn ngữ, trao đổi liên lạc, rủ đi chơi, trò chuyện hằng ngày và hẹn gặp lại. Câu phải dài khoảng 5-22 chữ Hán, diễn đạt trọn ý, không dùng tên người cụ thể, không hỏi thông tin quá nhạy cảm, không tán tỉnh quá mức và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng vào câu. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và đúng sắc thái giao tiếp. Mỗi câu chọn 1-3 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ đó phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
              : isChinaDailyLifeTemplate
                ? "Bạn là giáo viên tiếng Trung thực hành cho người Việt đang sống tại Trung Quốc. Hãy tạo câu tiếng Trung giản thể tự nhiên, rõ ràng và thực tế ở mức HSK1-HSK3, dùng được ngay trong đời sống. Nội dung bao quát thuê nhà, hợp đồng, điện nước, sửa chữa, giao hàng, hỏi đường, giao thông, WeChat, thanh toán, mua sắm và nhờ giúp đỡ. Ưu tiên mẫu nói lịch sự, an toàn, đúng văn hóa; không đưa lời khuyên pháp lý hoặc y tế tuyệt đối. Mỗi câu dài khoảng 6-24 chữ Hán, diễn đạt trọn ý, không dùng tên người hay địa chỉ cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và phản ánh đúng ngữ cảnh. Mỗi câu chọn đúng 1-2 từ hoặc cụm từ mới quan trọng trong trường vocabulary; mỗi từ phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
                : isTravelAirportTemplate
                  ? "Bạn là giáo viên tiếng Trung du lịch cho người Việt đi Trung Quốc. Hãy tạo câu tiếng Trung giản thể tự nhiên, lịch sự, rõ ràng và dùng được ngay trong hành trình thực tế. Nội dung phải bao quát làm thủ tục sân bay, kiểm tra an ninh, nhập cảnh, hải quan, hành lý, tàu điện, xe buýt, taxi, khách sạn và tình huống khẩn cấp. Ưu tiên cách nói mà hành khách thật sự dùng với nhân viên sân bay, hải quan, tài xế, lễ tân, cảnh sát hoặc nhân viên y tế; không đưa lời khuyên pháp lý hay y tế tuyệt đối. Mỗi câu dài khoảng 6-24 chữ Hán, diễn đạt trọn ý, không dùng tên người, số chuyến bay, địa chỉ hoặc khách sạn cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và đúng ngữ cảnh du lịch. Mỗi câu chọn đúng 1-2 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
                  : isSalesCustomerServiceTemplate
                    ? "Bạn là giáo viên tiếng Trung thương mại chuyên đào tạo người Việt làm bán hàng và chăm sóc khách hàng. Hãy tạo câu tiếng Trung giản thể tự nhiên, lịch sự, chuyên nghiệp và dùng được ngay trong cửa hàng, kinh doanh trực tuyến, bán sỉ hoặc bộ phận chăm sóc khách hàng. Nội dung phải bao quát tìm hiểu nhu cầu, tư vấn sản phẩm, giải thích tính năng, báo giá, thuế và phí, thương lượng, chiết khấu, chốt đơn, giao hàng, theo dõi sau bán, đổi trả, hoàn tiền và xử lý khiếu nại. Phân biệt rõ lời của nhân viên với khách nhưng mỗi câu phải tự đứng độc lập, không chèn nhãn người nói. Không hứa vượt thẩm quyền, không gây áp lực mua hàng và không tranh cãi với khách. Mỗi câu dài khoảng 7-26 chữ Hán, diễn đạt trọn ý, không dùng tên người, tên công ty, mã đơn hoặc mức giá cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và phản ánh đúng ngữ cảnh bán hàng. Mỗi câu chọn đúng 1-2 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
                    : isLogisticsImportExportTemplate
                      ? "Bạn là giáo viên tiếng Trung thương mại chuyên đào tạo người Việt làm xuất nhập khẩu và logistics. Hãy tạo câu tiếng Trung giản thể tự nhiên, chính xác, lịch sự và dùng được ngay khi trao đổi với nhà cung cấp, hãng vận tải, kho, đại lý hải quan hoặc khách hàng. Nội dung phải bao quát tìm nguồn hàng, đơn mua, hợp đồng, Incoterms, thanh toán quốc tế, chứng từ, mã HS, khai báo hải quan, kho bãi, đóng gói, vận tải, giao nhận, theo dõi lô hàng, sự cố và bồi thường. Dùng đúng thuật ngữ nghề nghiệp nhưng câu phải dễ hiểu và tự đứng độc lập; không chèn nhãn người nói. Không đưa lời khuyên pháp lý tuyệt đối, không bịa quy định hải quan và không dùng tên công ty, mã đơn, số container, mức giá hoặc tuyến vận chuyển cụ thể. Mỗi câu dài khoảng 8-28 chữ Hán, diễn đạt trọn ý và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và dùng đúng thuật ngữ xuất nhập khẩu. Mỗi câu chọn đúng 1-2 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
                      : isCommercialContractNegotiationTemplate
                        ? "Bạn là giáo viên tiếng Trung thương mại chuyên đào tạo người Việt làm kinh doanh, hợp đồng và đàm phán. Hãy tạo câu tiếng Trung giản thể tự nhiên, chính xác, lịch sự và dùng được ngay khi trao đổi với khách hàng, nhà cung cấp, đại lý hoặc đối tác. Nội dung phải bao quát báo giá, chính sách giá, chiết khấu, thương lượng, điều khoản hợp đồng, ký kết, gia hạn, đơn hàng, đặt cọc, thanh toán, hóa đơn, công nợ, đối soát, phân phối, hậu mãi, khiếu nại và giải quyết tranh chấp. Dùng đúng thuật ngữ thương mại nhưng câu phải dễ hiểu, tự đứng độc lập và không chèn nhãn người nói. Không đưa lời khuyên pháp lý tuyệt đối, không cam kết vượt thẩm quyền, không dùng tên công ty, mã hợp đồng, số tiền hay ngày tháng cụ thể. Mỗi câu dài khoảng 8-28 chữ Hán, diễn đạt trọn ý, thể hiện đa dạng ý định giao tiếp và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và dùng đúng thuật ngữ thương mại. Mỗi câu chọn đúng 1-2 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
                        : isWorkCallsMessagesTemplate
                          ? "Bạn là giáo viên tiếng Trung công sở chuyên đào tạo người Việt gọi điện và nhắn tin trong công việc. Hãy tạo câu tiếng Trung giản thể tự nhiên, ngắn gọn, lịch sự và dùng được ngay khi liên lạc với đồng nghiệp, khách hàng, nhà cung cấp hoặc đối tác. Nội dung phải bao quát mở đầu và tiếp nhận cuộc gọi, hỏi người cần gặp, chuyển máy, để lại lời nhắn, hẹn gọi lại, xác nhận lịch và thông tin, nhắn WeChat, gửi tài liệu, nhắc phản hồi, xử lý tín hiệu yếu, nghe không rõ, nhầm số và kết thúc cuộc gọi. Mỗi câu phải tự đứng độc lập, không chèn nhãn người nói, không dùng tên người, tên công ty, số điện thoại, địa chỉ email hoặc thời gian cụ thể. Ưu tiên cách diễn đạt thật sự được dùng trong môi trường làm việc, không quá thân mật và không dài dòng. Mỗi câu dài khoảng 6-24 chữ Hán, diễn đạt trọn ý và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và đúng sắc thái công việc. Mỗi câu chọn đúng 1-2 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
                          : "Bạn là giáo viên tiếng Trung công sở cho người Việt. Hãy tạo các câu tiếng Trung giản thể tự nhiên, lịch sự và thực tế trong môi trường văn phòng hiện đại. Câu phải dài khoảng 8-28 chữ Hán, diễn đạt trọn ý, không dùng tên người hay tên công ty cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng vào câu. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và đúng sắc thái công việc. Mỗi câu chọn 1-3 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ đó phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu.",
        },
        {
          role: "user",
          content: JSON.stringify({
            attempt,
            category_id: spec.id,
            category_name: spec.name,
            exact_count: requestCount,
            valid_items_still_needed: remaining,
            scope: spec.scope,
            situations_that_must_be_well_represented:
              spec.requiredSituations,
            forbidden_duplicate_sentences: [
              ...excludedSentences,
              ...collected.keys(),
            ],
          }),
        },
      ],
    });
    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error(`OpenAI không trả dữ liệu cho nhóm ${spec.name}.`);
    }

    const response = responseSchema.parse(JSON.parse(content));
    for (const rawCard of response.items) {
      if (collected.size >= spec.count) {
        break;
      }
      const card = { ...normalizeSentence(rawCard), category: spec.id };
      const reason = rejectionReason(
        card,
        forbiddenSentences,
        new Set(collected.keys()),
      );
      if (reason) {
        console.warn(
          `[data] Bỏ ${card.sentence_cn || "(trống)"}: ${reason}.`,
        );
        continue;
      }
      collected.set(card.sentence_cn, card);
    }

    console.log(
      `[data] ${spec.name}: ${collected.size}/${spec.count} câu hợp lệ.`,
    );
    if (collected.size < spec.count) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }

  return validateCategory(
    spec,
    Array.from(collected.values()),
    forbiddenSentences,
  );
}

async function buildSentences() {
  const total = categories.reduce(
    (sum, category) => sum + category.count,
    0,
  );
  if (total !== expectedTotal) {
    throw new Error(
      `Các nhóm phải có tổng ${expectedTotal} câu, hiện là ${total}.`,
    );
  }

  let cached = readCache();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 180_000,
  });

  for (const spec of categories) {
    const categoryCards = cached.filter((card) => card.category === spec.id);
    const otherCards = cached.filter((card) => card.category !== spec.id);
    const excludedSentences = new Set(
      otherCards.map((card) => card.sentence_cn),
    );

    try {
      validateCategory(spec, categoryCards, excludedSentences);
      console.log(`[data] Dùng cache ${spec.name}: ${spec.count} câu.`);
      continue;
    } catch (error) {
      console.warn(
        `[data] Cache ${spec.name} không hợp lệ, sẽ tạo bù: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      cached = otherCards;
    }

    const generated = await generateCategory(
      openai,
      spec,
      cached.map((card) => card.sentence_cn),
    );
    cached.push(...generated);
    saveCache(cached);
  }

  const ordered = categories.flatMap((spec) =>
    cached.filter((card) => card.category === spec.id),
  );
  if (
    ordered.length !== expectedTotal ||
    new Set(ordered.map((card) => card.sentence_cn)).size !== expectedTotal
  ) {
    throw new Error(
      `${templateName} phải có đúng ${expectedTotal} câu duy nhất.`,
    );
  }
  saveCache(ordered);
  return ordered;
}

async function createAudioWithRetry(text: string) {
  if (useEdgeTtsOnly) {
    return createTemplateSpeechWithEdge(text);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await getOrCreateTemplateSpeech(
        templateSlug,
        "sentence",
        text,
      );
    } catch (error) {
      lastError = error;
      const quotaExceeded =
        error instanceof OpenAI.APIError &&
        (error.status === 429 || error.code === "insufficient_quota");
      if (quotaExceeded) {
        useEdgeTtsOnly = true;
        console.warn(
          "[audio] OpenAI TTS đã hết hạn mức, chuyển sang Microsoft Edge TTS.",
        );
        break;
      }
      console.warn(`[audio] Thử lại lần ${attempt}/4 cho: ${text}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  try {
    return await createTemplateSpeechWithEdge(text);
  } catch (fallbackError) {
    throw new AggregateError(
      [lastError, fallbackError],
      `Không thể tạo audio cho: ${text}`,
    );
  }
}

async function createTemplateSpeechWithEdge(text: string) {
  const textHash = createHash("sha256")
    .update(text)
    .digest("hex")
    .slice(0, 24);
  const audioPath = `templates/${templateSlug}/sentence-${textHash}.mp3`;
  const temporaryPath = path.join(
    os.tmpdir(),
    `${templateSlug}-${textHash}.mp3`,
  );

  try {
    await execFileAsync(
      "python",
      [
        "-m",
        "edge_tts",
        "--voice",
        "zh-CN-XiaoxiaoNeural",
        "--text",
        text,
        "--write-media",
        temporaryPath,
      ],
      { timeout: 120_000, windowsHide: true },
    );
    const audio = fs.readFileSync(temporaryPath);
    if (audio.length === 0) {
      throw new Error("Microsoft Edge TTS trả về file audio trống.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage
      .from("card-audio")
      .upload(audioPath, audio, {
        cacheControl: "31536000",
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (error) {
      throw error;
    }
    return supabase.storage.from("card-audio").getPublicUrl(audioPath).data
      .publicUrl;
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

async function buildCards(sentences: GeneratedSentence[]) {
  async function createCard(
    sentence: GeneratedSentence,
    index: number,
  ) {
    const position = index + 1;
    console.log(`[audio ${position}/${expectedTotal}] ${sentence.sentence_cn}`);
    const sentenceAudioUrl = await createAudioWithRetry(
      sentence.sentence_cn,
    );
    if (!sentenceAudioUrl) {
      throw new Error(`Không tạo được audio cho ${sentence.sentence_cn}.`);
    }
    return {
      ...sentence,
      position,
      sentenceAudioUrl,
    } satisfies OfficeSentenceCard;
  }

  const cards: OfficeSentenceCard[] = [];
  for (
    let index = 0;
    index < sentences.length;
    index += audioConcurrency
  ) {
    cards.push(
      ...(await Promise.all(
        sentences
          .slice(index, index + audioConcurrency)
          .map((sentence, offset) =>
            createCard(sentence, index + offset),
          ),
      )),
    );
  }
  return cards;
}

function buildMigration(cards: OfficeSentenceCard[]) {
  const values = cards
    .map(
      (card) =>
        `    (${[
          card.sentence_cn,
          card.sentence_pinyin,
          card.sentence_vi,
          JSON.stringify(card.vocabulary),
          card.sentenceAudioUrl,
        ]
          .map(sqlLiteral)
          .join(", ")}, ${card.position})`,
    )
    .join(",\n");
  const activeSentences = cards
    .map((card) => sqlLiteral(card.sentence_cn))
    .join(", ");

  return `-- Add a reusable ${expectedTotal}-sentence situational deck with highlighted vocabulary and audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  ${sqlLiteral(templateName)},
  ${sqlLiteral(templateDescription)},
  'Luyện câu'
)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = '${templateSlug}'
)
insert into public.template_sentence_cards (
  template_deck_id, sentence_cn, sentence_pinyin, sentence_vi,
  vocab_json, sentence_audio_url, position
)
select
  target_deck.id, card.sentence_cn, card.sentence_pinyin,
  card.sentence_vi, card.vocab_json::jsonb,
  card.sentence_audio_url, card.position
from target_deck
cross join (
  values
${values}
) as card(
  sentence_cn, sentence_pinyin, sentence_vi,
  vocab_json, sentence_audio_url, position
)
on conflict (template_deck_id, sentence_cn) do update
set
  sentence_pinyin = excluded.sentence_pinyin,
  sentence_vi = excluded.sentence_vi,
  vocab_json = excluded.vocab_json,
  sentence_audio_url = excluded.sentence_audio_url,
  position = excluded.position;

delete from public.template_sentence_cards
where template_deck_id = (
  select id from public.template_decks where slug = '${templateSlug}'
)
and sentence_cn not in (${activeSentences});
`;
}

async function syncTemplate(cards: OfficeSentenceCard[]) {
  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("template_decks")
    .upsert(
      {
        slug: templateSlug,
        name: templateName,
        description: templateDescription,
        level: "Luyện câu",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (deckError || !deck) {
    throw deckError || new Error("Không thể tạo bộ luyện câu mẫu.");
  }

  const rows = cards.map((card) => ({
    template_deck_id: deck.id,
    sentence_cn: card.sentence_cn,
    sentence_pinyin: card.sentence_pinyin,
    sentence_vi: card.sentence_vi,
    vocab_json: card.vocabulary,
    sentence_audio_url: card.sentenceAudioUrl,
    position: card.position,
  }));

  for (let index = 0; index < rows.length; index += 50) {
    const { error } = await supabase
      .from("template_sentence_cards")
      .upsert(rows.slice(index, index + 50), {
        onConflict: "template_deck_id,sentence_cn",
      });
    if (error) {
      throw error;
    }
  }

  const activeSentences = new Set(
    cards.map((card) => card.sentence_cn),
  );
  const { data: existingCards, error: existingError } = await supabase
    .from("template_sentence_cards")
    .select("id,sentence_cn")
    .eq("template_deck_id", deck.id);
  if (existingError) {
    throw existingError;
  }

  const staleCardIds = (existingCards || [])
    .filter((card) => !activeSentences.has(card.sentence_cn))
    .map((card) => card.id);
  if (staleCardIds.length > 0) {
    const { error } = await supabase
      .from("template_sentence_cards")
      .delete()
      .in("id", staleCardIds);
    if (error) {
      throw error;
    }
  }

  const { count, error: countError } = await supabase
    .from("template_sentence_cards")
    .select("id", { count: "exact", head: true })
    .eq("template_deck_id", deck.id);
  if (countError) {
    throw countError;
  }
  if (count !== expectedTotal) {
    throw new Error(
      `Supabase cần có ${expectedTotal} câu, hiện có ${count ?? 0}.`,
    );
  }

  const activeAudioFiles = new Set(
    cards.map((card) =>
      new URL(card.sentenceAudioUrl).pathname.split("/").at(-1),
    ),
  );
  const audioFolder = `templates/${templateSlug}`;
  const { data: storedAudio, error: storageError } = await supabase.storage
    .from("card-audio")
    .list(audioFolder, { limit: 1000 });
  if (storageError) {
    throw storageError;
  }

  const staleAudioPaths = (storedAudio || [])
    .filter((file) => !activeAudioFiles.has(file.name))
    .map((file) => `${audioFolder}/${file.name}`);
  if (staleAudioPaths.length > 0) {
    const { error } = await supabase.storage
      .from("card-audio")
      .remove(staleAudioPaths);
    if (error) {
      throw error;
    }
  }

  console.log(
    `[sync] Đã đồng bộ ${count} câu; dọn ${staleCardIds.length} câu và ${staleAudioPaths.length} audio cũ.`,
  );
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }
  const sentences = await buildSentences();
  const cards = await buildCards(sentences);
  fs.writeFileSync(outputPath, buildMigration(cards), "utf8");
  await syncTemplate(cards);
  console.log(`Đã tạo ${outputPath} với ${cards.length} câu đầy đủ.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
