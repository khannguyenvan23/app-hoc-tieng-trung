import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  requiredTopics: string[];
};

type GeneratedCard = {
  category: string;
  chinese: string;
  pinyin: string;
  meaning_vi: string;
  example_cn: string;
  example_pinyin: string;
  example_vi: string;
};

type FactoryCard = GeneratedCard & {
  position: number;
  wordAudioUrl: string;
  sentenceAudioUrl: string;
};

const isLogisticsTemplate = process.argv.includes("--logistics");
const isConstructionTemplate = process.argv.includes("--construction");
const templateSlug = isLogisticsTemplate
  ? "xuat-nhap-khau-logistics-300-tu"
  : isConstructionTemplate
    ? "xay-dung-cong-trinh-300-tu"
    : "nha-may-xuong-300";
const templateName = isLogisticsTemplate
  ? "Xuất nhập khẩu và logistics - 300 từ"
  : isConstructionTemplate
    ? "Tiếng Trung xây dựng và công trình - 300 từ"
    : "Tiếng Trung nhà máy/xưởng - 300 từ";
const templateDescription = isLogisticsTemplate
  ? "300 từ vựng tiếng Trung thực tế về mua hàng, hợp đồng, Incoterms, chứng từ, hải quan, kho bãi, đóng gói, vận tải, giao nhận và xử lý sự cố. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ thực tế và hai audio tạo sẵn."
  : isConstructionTemplate
    ? "300 từ vựng tiếng Trung thực tế về vật liệu, dụng cụ, máy thi công, bản vẽ, kết cấu, điện nước, hoàn thiện, tiến độ, nghiệm thu và an toàn công trình. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ thực tế và hai audio tạo sẵn."
    : "300 từ vựng tiếng Trung thực tế về máy móc, dây chuyền, thao tác sản xuất, kiểm tra chất lượng, lỗi sản phẩm, bảo trì, kho vận và an toàn lao động. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và audio tạo sẵn.";
const templateLevel = isLogisticsTemplate
  ? "Logistics"
  : isConstructionTemplate
    ? "Xây dựng"
    : "Nhà máy";
const outputPath = isLogisticsTemplate
  ? "supabase/migrations/049_logistics_import_export_300_words.sql"
  : isConstructionTemplate
    ? "supabase/migrations/051_construction_300_words.sql"
    : "supabase/migrations/039_factory_300_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  isLogisticsTemplate
    ? "tiengtrunghihi-logistics-import-export-300-cards.json"
    : isConstructionTemplate
      ? "tiengtrunghihi-construction-300-cards.json"
      : "tiengtrunghihi-factory-300-cards.json",
);
const audioConcurrency = 3;

const factoryCategories: CategorySpec[] = [
  {
    id: "workforce",
    name: "Nhân sự và tổ chức trong xưởng",
    count: 25,
    scope:
      "Chức danh, bộ phận, vai trò và quan hệ công việc thường gặp trong nhà máy.",
    requiredTopics: [
      "công nhân",
      "tổ trưởng",
      "quản đốc",
      "kỹ sư",
      "kỹ thuật viên",
      "nhân viên kiểm tra chất lượng",
      "bộ phận sản xuất",
      "bộ phận kỹ thuật",
      "ca trưởng",
      "nhân viên mới",
    ],
  },
  {
    id: "factory",
    name: "Nhà xưởng và dây chuyền",
    count: 25,
    scope:
      "Khu vực nhà máy, dây chuyền, trạm làm việc và cơ sở hạ tầng sản xuất.",
    requiredTopics: [
      "nhà máy",
      "xưởng",
      "dây chuyền sản xuất",
      "khu vực làm việc",
      "trạm làm việc",
      "phòng sạch",
      "kho nguyên liệu",
      "kho thành phẩm",
      "lối thoát hiểm",
      "bảng điều khiển",
    ],
  },
  {
    id: "machinery",
    name: "Máy móc và thiết bị",
    count: 35,
    scope:
      "Máy sản xuất, thiết bị tự động hóa và bộ phận máy thường dùng trong nhiều ngành.",
    requiredTopics: [
      "máy móc",
      "thiết bị",
      "động cơ",
      "băng tải",
      "robot công nghiệp",
      "máy ép",
      "máy cắt",
      "máy hàn",
      "máy đóng gói",
      "cảm biến",
      "khuôn",
      "công tắc",
      "van",
      "trục",
      "vòng bi",
    ],
  },
  {
    id: "tools-materials",
    name: "Dụng cụ, linh kiện và vật liệu",
    count: 30,
    scope:
      "Dụng cụ cầm tay, chi tiết máy, vật tư tiêu hao, nguyên liệu và bán thành phẩm.",
    requiredTopics: [
      "dụng cụ",
      "cờ lê",
      "tua vít",
      "kìm",
      "thước đo",
      "ốc vít",
      "linh kiện",
      "phụ tùng",
      "nguyên liệu",
      "bán thành phẩm",
      "thành phẩm",
      "dầu bôi trơn",
    ],
  },
  {
    id: "operations",
    name: "Thao tác và quy trình sản xuất",
    count: 35,
    scope:
      "Các động tác vận hành máy và các bước trong quy trình sản xuất hằng ngày.",
    requiredTopics: [
      "khởi động máy",
      "tắt máy",
      "vận hành",
      "lắp ráp",
      "gia công",
      "hàn",
      "cắt",
      "đóng gói",
      "dán nhãn",
      "điều chỉnh",
      "cài đặt thông số",
      "chạy thử",
      "sản xuất hàng loạt",
      "ghi chép sản lượng",
    ],
  },
  {
    id: "quality",
    name: "Chất lượng và kiểm tra",
    count: 35,
    scope:
      "Kiểm tra chất lượng, tiêu chuẩn, phép đo, mẫu kiểm tra và kết quả nghiệm thu.",
    requiredTopics: [
      "chất lượng",
      "kiểm tra",
      "tiêu chuẩn",
      "dung sai",
      "kích thước",
      "độ chính xác",
      "lấy mẫu",
      "kiểm tra ngoại quan",
      "đạt yêu cầu",
      "không đạt",
      "tỷ lệ đạt",
      "báo cáo kiểm tra",
      "truy xuất nguồn gốc",
    ],
  },
  {
    id: "defects-maintenance",
    name: "Lỗi sản phẩm, sự cố và bảo trì",
    count: 35,
    scope:
      "Tên lỗi phổ biến, hiện tượng bất thường, xử lý sự cố, sửa chữa và bảo dưỡng.",
    requiredTopics: [
      "sản phẩm lỗi",
      "vết nứt",
      "trầy xước",
      "biến dạng",
      "thiếu linh kiện",
      "lắp sai",
      "rò rỉ",
      "quá nhiệt",
      "tiếng ồn bất thường",
      "máy dừng",
      "hỏng hóc",
      "sửa chữa",
      "bảo trì",
      "bảo dưỡng định kỳ",
      "thay thế phụ tùng",
    ],
  },
  {
    id: "safety",
    name: "An toàn lao động và ứng phó khẩn cấp",
    count: 30,
    scope:
      "Quy định an toàn, bảo hộ cá nhân, cảnh báo nguy hiểm và xử lý tai nạn trong xưởng.",
    requiredTopics: [
      "an toàn lao động",
      "mũ bảo hộ",
      "kính bảo hộ",
      "găng tay",
      "giày bảo hộ",
      "nút dừng khẩn cấp",
      "biển cảnh báo",
      "nguy hiểm",
      "điện giật",
      "cháy",
      "bình chữa cháy",
      "sơ cứu",
      "tai nạn lao động",
      "báo cáo sự cố",
    ],
  },
  {
    id: "warehouse-logistics",
    name: "Kho, đóng gói và logistics nội bộ",
    count: 25,
    scope:
      "Nhập xuất kho, tồn kho, mã hàng, pallet, xe nâng, vận chuyển và giao nhận nội bộ.",
    requiredTopics: [
      "nhập kho",
      "xuất kho",
      "tồn kho",
      "kiểm kê",
      "mã hàng",
      "mã vạch",
      "pallet",
      "xe nâng",
      "phiếu nhập kho",
      "phiếu xuất kho",
      "đóng thùng",
      "giao hàng",
    ],
  },
  {
    id: "instructions-shifts",
    name: "Chỉ dẫn công việc, ca làm và giao tiếp",
    count: 25,
    scope:
      "Mệnh lệnh, báo cáo tiến độ, bàn giao ca, năng suất và giao tiếp thực tế trong xưởng.",
    requiredTopics: [
      "ca ngày",
      "ca đêm",
      "đổi ca",
      "bàn giao ca",
      "tăng ca",
      "nghỉ giải lao",
      "hướng dẫn công việc",
      "quy trình thao tác chuẩn",
      "kế hoạch sản xuất",
      "tiến độ",
      "sản lượng",
      "năng suất",
      "hoàn thành đúng hạn",
    ],
  },
];

const logisticsCategories: CategorySpec[] = [
  {
    id: "sourcing-purchasing",
    name: "Tìm nguồn hàng và mua hàng",
    count: 30,
    scope:
      "Từ vựng dùng khi tìm nhà cung cấp, hỏi thông tin sản phẩm, lấy mẫu, đặt mua và quản lý đơn mua hàng.",
    requiredTopics: [
      "nhà cung cấp",
      "tìm nguồn hàng",
      "yêu cầu mua hàng",
      "đơn mua hàng",
      "mẫu hàng",
      "số lượng đặt tối thiểu",
      "năng lực cung ứng",
      "thời gian sản xuất",
      "đánh giá nhà cung cấp",
      "xác nhận đơn hàng",
      "mã hàng",
      "quy cách sản phẩm",
    ],
  },
  {
    id: "contracts-payment",
    name: "Hợp đồng và thanh toán quốc tế",
    count: 30,
    scope:
      "Điều khoản hợp đồng thương mại, báo giá, tiền tệ, đặt cọc, thanh toán và đối soát công nợ.",
    requiredTopics: [
      "hợp đồng ngoại thương",
      "báo giá",
      "điều khoản thanh toán",
      "tiền đặt cọc",
      "chuyển khoản",
      "thư tín dụng",
      "thanh toán nhờ thu",
      "số dư",
      "công nợ",
      "tỷ giá",
      "ngày đến hạn",
      "biên lai thanh toán",
    ],
  },
  {
    id: "trade-terms",
    name: "Điều kiện thương mại và giá thành",
    count: 30,
    scope:
      "Incoterms, trách nhiệm người mua và người bán, cấu thành giá, bảo hiểm và phân chia rủi ro.",
    requiredTopics: [
      "Incoterms",
      "FOB",
      "CIF",
      "EXW",
      "DDP",
      "giá xuất xưởng",
      "cước vận chuyển",
      "phí bảo hiểm",
      "chuyển giao rủi ro",
      "cảng đi",
      "cảng đến",
      "chi phí phát sinh",
    ],
  },
  {
    id: "trade-documents",
    name: "Chứng từ xuất nhập khẩu",
    count: 30,
    scope:
      "Các chứng từ thương mại và vận tải cần thiết để khai báo, giao nhận và thanh toán quốc tế.",
    requiredTopics: [
      "hóa đơn thương mại",
      "phiếu đóng gói",
      "vận đơn",
      "giấy chứng nhận xuất xứ",
      "chứng thư kiểm dịch",
      "hợp đồng",
      "tờ khai hải quan",
      "giấy phép nhập khẩu",
      "bản gốc",
      "bản sao",
      "ký tên đóng dấu",
      "sửa chứng từ",
    ],
  },
  {
    id: "customs-compliance",
    name: "Hải quan và tuân thủ",
    count: 30,
    scope:
      "Khai báo hải quan, mã HS, thuế, kiểm tra chuyên ngành, thông quan và xử lý yêu cầu bổ sung hồ sơ.",
    requiredTopics: [
      "hải quan",
      "khai báo",
      "mã HS",
      "thuế nhập khẩu",
      "thuế giá trị gia tăng",
      "trị giá tính thuế",
      "kiểm hóa",
      "thông quan",
      "luồng xanh",
      "luồng vàng",
      "luồng đỏ",
      "hồ sơ bổ sung",
      "hàng cấm",
      "hàng hạn chế",
    ],
  },
  {
    id: "warehouse-inventory",
    name: "Kho bãi và quản lý tồn kho",
    count: 30,
    scope:
      "Nhập kho, xuất kho, vị trí lưu trữ, kiểm kê, tồn kho và điều phối hàng trong kho.",
    requiredTopics: [
      "kho ngoại quan",
      "nhập kho",
      "xuất kho",
      "tồn kho",
      "kiểm kê",
      "vị trí lưu kho",
      "mã vạch",
      "pallet",
      "xe nâng",
      "phiếu nhập kho",
      "phiếu xuất kho",
      "hàng tồn lâu",
      "quản lý lô",
    ],
  },
  {
    id: "packaging-labeling",
    name: "Đóng gói và ghi nhãn",
    count: 30,
    scope:
      "Bao bì xuất khẩu, đóng kiện, ký mã hiệu, nhãn vận chuyển, quy cách và bảo vệ hàng hóa.",
    requiredTopics: [
      "bao bì",
      "thùng carton",
      "kiện gỗ",
      "đóng gói chống ẩm",
      "chống va đập",
      "niêm phong",
      "ký mã hiệu",
      "nhãn vận chuyển",
      "trọng lượng tịnh",
      "trọng lượng cả bì",
      "kích thước kiện",
      "hàng dễ vỡ",
    ],
  },
  {
    id: "international-transport",
    name: "Vận tải quốc tế",
    count: 30,
    scope:
      "Vận tải biển, hàng không, đường bộ, container, lịch trình và đặt chỗ vận chuyển.",
    requiredTopics: [
      "vận tải biển",
      "vận tải hàng không",
      "vận tải đường bộ",
      "container",
      "hàng nguyên container",
      "hàng lẻ",
      "đặt chỗ",
      "hãng tàu",
      "chuyến bay chở hàng",
      "lịch tàu",
      "ngày khởi hành",
      "ngày dự kiến đến",
      "chuyển tải",
    ],
  },
  {
    id: "delivery-tracking",
    name: "Giao nhận và theo dõi lô hàng",
    count: 30,
    scope:
      "Giao hàng, nhận hàng, theo dõi hành trình, phối hợp đại lý và xác nhận hoàn tất giao nhận.",
    requiredTopics: [
      "giao nhận",
      "đại lý vận tải",
      "người gửi hàng",
      "người nhận hàng",
      "lệnh giao hàng",
      "thông báo hàng đến",
      "theo dõi lô hàng",
      "bằng chứng giao hàng",
      "ký nhận",
      "giao tận nơi",
      "điểm nhận hàng",
      "thời gian giao hàng",
    ],
  },
  {
    id: "exceptions-claims",
    name: "Sự cố, khiếu nại và bồi thường",
    count: 30,
    scope:
      "Xử lý giao chậm, thất lạc, thiếu hàng, hư hỏng, phí lưu kho, khiếu nại và yêu cầu bồi thường.",
    requiredTopics: [
      "giao hàng chậm",
      "thất lạc",
      "thiếu hàng",
      "hàng hư hỏng",
      "sai chứng từ",
      "phí lưu container",
      "phí lưu bãi",
      "kiểm tra hiện trường",
      "biên bản bất thường",
      "khiếu nại",
      "bồi thường",
      "bảo hiểm hàng hóa",
      "giải phóng hàng",
    ],
  },
];

const constructionCategories: CategorySpec[] = [
  {
    id: "site-personnel-management",
    name: "Nhân sự và quản lý công trường",
    count: 30,
    scope:
      "Chức danh, bộ phận, khu vực làm việc, hồ sơ và hoạt động điều phối thường gặp tại công trường xây dựng.",
    requiredTopics: [
      "chủ đầu tư",
      "nhà thầu chính",
      "nhà thầu phụ",
      "chỉ huy trưởng",
      "kỹ sư hiện trường",
      "giám sát thi công",
      "đội trưởng",
      "công nhân xây dựng",
      "công trường",
      "nhật ký thi công",
      "họp giao ban",
      "biện pháp thi công",
      "bàn giao mặt bằng",
    ],
  },
  {
    id: "construction-materials",
    name: "Vật liệu xây dựng",
    count: 30,
    scope:
      "Vật liệu kết cấu, xây trát, chống thấm, cách nhiệt và vật tư tiêu hao dùng phổ biến trong công trình.",
    requiredTopics: [
      "xi măng",
      "cát",
      "đá",
      "gạch",
      "bê tông",
      "thép cốt bê tông",
      "vữa",
      "phụ gia",
      "tấm thạch cao",
      "vật liệu chống thấm",
      "vật liệu cách nhiệt",
      "gỗ",
      "kính",
      "sơn",
      "keo xây dựng",
    ],
  },
  {
    id: "tools-measurement",
    name: "Dụng cụ và đo đạc",
    count: 30,
    scope:
      "Dụng cụ cầm tay, dụng cụ điện, thiết bị đo và thao tác đo kiểm kích thước tại hiện trường.",
    requiredTopics: [
      "búa",
      "xẻng",
      "bay xây",
      "cờ lê",
      "kìm",
      "máy khoan",
      "máy cắt",
      "thước cuộn",
      "thước thủy",
      "máy đo khoảng cách",
      "máy thủy bình",
      "máy toàn đạc",
      "dây dọi",
      "đo cao độ",
      "kiểm tra kích thước",
    ],
  },
  {
    id: "construction-machinery",
    name: "Máy móc và thiết bị thi công",
    count: 30,
    scope:
      "Máy đào, nâng, vận chuyển, trộn, đầm, bơm và các thiết bị cơ giới thường dùng trên công trường.",
    requiredTopics: [
      "máy xúc",
      "máy ủi",
      "máy đào",
      "cần cẩu",
      "xe nâng",
      "xe ben",
      "máy trộn bê tông",
      "máy bơm bê tông",
      "máy đầm",
      "máy phát điện",
      "giàn giáo",
      "vận thăng",
      "cáp nâng",
      "bảo dưỡng thiết bị",
      "bán kính hoạt động",
    ],
  },
  {
    id: "drawings-surveying",
    name: "Bản vẽ, kích thước và trắc địa",
    count: 30,
    scope:
      "Bản vẽ kỹ thuật, ký hiệu, tỷ lệ, tọa độ, cao độ, tim trục và hoạt động định vị công trình.",
    requiredTopics: [
      "bản vẽ thiết kế",
      "bản vẽ thi công",
      "bản vẽ hoàn công",
      "mặt bằng",
      "mặt đứng",
      "mặt cắt",
      "chi tiết cấu tạo",
      "tỷ lệ bản vẽ",
      "kích thước",
      "cao độ",
      "tọa độ",
      "tim trục",
      "mốc trắc địa",
      "định vị",
      "sai số đo",
    ],
  },
  {
    id: "foundation-structure",
    name: "Nền móng và kết cấu",
    count: 30,
    scope:
      "Đào đất, xử lý nền, móng, cọc, dầm, cột, sàn, tường chịu lực và các bộ phận kết cấu chính.",
    requiredTopics: [
      "đào móng",
      "hố móng",
      "nền đất",
      "móng đơn",
      "móng băng",
      "móng bè",
      "cọc bê tông",
      "ép cọc",
      "đài cọc",
      "dầm",
      "cột",
      "sàn",
      "tường chịu lực",
      "khe co giãn",
      "gia cố kết cấu",
    ],
  },
  {
    id: "concrete-formwork-masonry",
    name: "Cốt thép, cốp pha, bê tông và xây trát",
    count: 30,
    scope:
      "Gia công lắp dựng cốt thép, cốp pha, đổ và bảo dưỡng bê tông, xây tường, trát và kiểm soát bề mặt.",
    requiredTopics: [
      "cắt thép",
      "uốn thép",
      "buộc thép",
      "lớp bê tông bảo vệ",
      "cốp pha",
      "chống cốp pha",
      "đổ bê tông",
      "đầm bê tông",
      "mạch ngừng",
      "bảo dưỡng bê tông",
      "tháo cốp pha",
      "xây tường",
      "mạch vữa",
      "trát tường",
      "độ phẳng bề mặt",
    ],
  },
  {
    id: "mep-installation",
    name: "Điện, nước và hệ thống kỹ thuật",
    count: 30,
    scope:
      "Lắp đặt điện, cấp thoát nước, điều hòa, thông gió, phòng cháy chữa cháy và phối hợp hệ thống kỹ thuật.",
    requiredTopics: [
      "ống luồn dây",
      "dây điện",
      "tủ điện",
      "cầu dao",
      "tiếp địa",
      "ống cấp nước",
      "ống thoát nước",
      "van nước",
      "bơm nước",
      "điều hòa không khí",
      "ống gió",
      "quạt thông gió",
      "đầu báo cháy",
      "ống chữa cháy",
      "thử áp lực",
    ],
  },
  {
    id: "finishing-quality",
    name: "Hoàn thiện và kiểm soát chất lượng",
    count: 30,
    scope:
      "Ốp lát, sơn, trần, cửa, chống thấm, sửa lỗi hoàn thiện và các bước kiểm tra chất lượng.",
    requiredTopics: [
      "ốp gạch",
      "lát nền",
      "chà ron",
      "bả tường",
      "sơn lót",
      "sơn phủ",
      "trần thạch cao",
      "lắp cửa",
      "lắp kính",
      "chống thấm",
      "độ phẳng",
      "vết nứt",
      "rỗ bê tông",
      "sai lệch kích thước",
      "sửa chữa khuyết tật",
    ],
  },
  {
    id: "safety-progress-acceptance",
    name: "An toàn, tiến độ và nghiệm thu",
    count: 30,
    scope:
      "Trang bị bảo hộ, phòng ngừa rủi ro, kế hoạch tiến độ, kiểm tra, nghiệm thu, bàn giao và xử lý chậm trễ.",
    requiredTopics: [
      "mũ bảo hộ",
      "dây an toàn",
      "giày bảo hộ",
      "lan can an toàn",
      "lưới an toàn",
      "biển cảnh báo",
      "làm việc trên cao",
      "không gian hạn chế",
      "giấy phép làm việc",
      "kế hoạch tiến độ",
      "khối lượng hoàn thành",
      "chậm tiến độ",
      "nghiệm thu công việc",
      "nghiệm thu hoàn thành",
      "bàn giao công trình",
    ],
  },
];

const categories = isLogisticsTemplate
  ? logisticsCategories
  : isConstructionTemplate
    ? constructionCategories
    : factoryCategories;

const generatedSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().min(1),
      chinese: z.string().min(1),
      pinyin: z.string().min(1),
      meaning_vi: z.string().min(1),
      example_cn: z.string().min(2),
      example_pinyin: z.string().min(2),
      example_vi: z.string().min(2),
    }),
  ),
});

const toneMarkPattern =
  /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]/u;
const vietnameseAccentPattern = /[À-ỹĐđ]/u;

const factoryDataCorrections: Record<string, Partial<GeneratedCard>> = {
  原材料仓库: {
    pinyin: "yuáncáiliào cāngkù",
  },
  电烙铁: {
    pinyin: "diàn làotiě",
    example_pinyin:
      "Diànzǐ zǔzhuāng gōng shǐyòng diàn làotiě hànjiē diànlùbǎn.",
  },
  轴承磨损: {
    pinyin: "zhóuchéng mósǔn",
    meaning_vi: "ổ bi bị mòn",
    example_pinyin:
      "Zhóuchéng mósǔn yánzhòng, xūyào gēnghuàn xīn de cáinéng jìxù shǐyòng.",
  },
  标准作业流程: {
    pinyin: "biāozhǔn zuòyè liúchéng",
    example_pinyin:
      "Suǒyǒu yuángōng bìxū yángé zūnshǒu biāozhǔn zuòyè liúchéng bǎozhèng chǎnpǐn zhìliàng.",
  },
};
const logisticsDataCorrections: Record<string, Partial<GeneratedCard>> = {
  合同: {
    pinyin: "hétóng",
  },
  指示账单: {
    chinese: "装运指示",
    pinyin: "zhuāngyùn zhǐshì",
    meaning_vi: "chỉ dẫn vận chuyển",
    example_cn: "发货前请确认装运指示中的收货地址和联系方式。",
    example_pinyin:
      "Fāhuò qián qǐng quèrèn zhuāngyùn zhǐshì zhōng de shōuhuò dìzhǐ hé liánxì fāngshì.",
    example_vi:
      "Trước khi gửi hàng, vui lòng xác nhận địa chỉ nhận và thông tin liên hệ trong chỉ dẫn vận chuyển.",
  },
  叉车操作: {
    example_vi:
      "Nhân viên vận hành xe nâng phải có chứng chỉ vận hành để bảo đảm an toàn khi bốc xếp.",
  },
  先入先出法: {
    example_vi:
      "Kho áp dụng phương pháp nhập trước xuất trước, bảo đảm hàng được xuất theo thứ tự từng lô.",
  },
};
const constructionDataCorrections: Record<
  string,
  Partial<GeneratedCard>
> = {};
const dataCorrections = isLogisticsTemplate
  ? logisticsDataCorrections
  : isConstructionTemplate
    ? constructionDataCorrections
    : factoryDataCorrections;

const fallbackCards: Record<string, GeneratedCard[]> = {
  "packaging-labeling": [
    {
      category: "packaging-labeling",
      chinese: "唛头",
      pinyin: "màitóu",
      meaning_vi: "ký mã hiệu hàng hóa",
      example_cn: "出口纸箱上的唛头必须与装箱单保持一致。",
      example_pinyin:
        "Chūkǒu zhǐxiāng shàng de màitóu bìxū yǔ zhuāngxiāngdān bǎochí yízhì.",
      example_vi:
        "Ký mã hiệu trên thùng hàng xuất khẩu phải khớp với phiếu đóng gói.",
    },
    {
      category: "packaging-labeling",
      chinese: "真空包装",
      pinyin: "zhēnkōng bāozhuāng",
      meaning_vi: "đóng gói chân không",
      example_cn: "这种零件采用真空包装，可以避免运输途中受潮。",
      example_pinyin:
        "Zhè zhǒng língjiàn cǎiyòng zhēnkōng bāozhuāng, kěyǐ bìmiǎn yùnshū túzhōng shòucháo.",
      example_vi:
        "Loại linh kiện này được đóng gói chân không để tránh ẩm trong quá trình vận chuyển.",
    },
    {
      category: "packaging-labeling",
      chinese: "托盘缠膜",
      pinyin: "tuōpán chánmó",
      meaning_vi: "quấn màng pallet",
      example_cn: "完成托盘缠膜后，请检查货物是否固定牢靠。",
      example_pinyin:
        "Wánchéng tuōpán chánmó hòu, qǐng jiǎnchá huòwù shìfǒu gùdìng láokào.",
      example_vi:
        "Sau khi quấn màng pallet, hãy kiểm tra hàng đã được cố định chắc chắn chưa.",
    },
    {
      category: "packaging-labeling",
      chinese: "护角",
      pinyin: "hùjiǎo",
      meaning_vi: "nẹp bảo vệ góc",
      example_cn: "包装人员在纸箱四周加上护角，防止边缘受损。",
      example_pinyin:
        "Bāozhuāng rényuán zài zhǐxiāng sìzhōu jiā shàng hùjiǎo, fángzhǐ biānyuán shòusǔn.",
      example_vi:
        "Nhân viên đóng gói lắp nẹp bảo vệ quanh thùng để tránh hư hỏng các cạnh.",
    },
    {
      category: "packaging-labeling",
      chinese: "防锈包装",
      pinyin: "fángxiù bāozhuāng",
      meaning_vi: "bao bì chống gỉ",
      example_cn: "海运时间较长，金属产品需要使用防锈包装。",
      example_pinyin:
        "Hǎiyùn shíjiān jiào cháng, jīnshǔ chǎnpǐn xūyào shǐyòng fángxiù bāozhuāng.",
      example_vi:
        "Do thời gian vận chuyển đường biển dài, sản phẩm kim loại cần dùng bao bì chống gỉ.",
    },
  ],
  "customs-compliance": [
    {
      category: "customs-compliance",
      chinese: "预归类",
      pinyin: "yù guīlèi",
      meaning_vi: "phân loại mã HS trước",
      example_cn: "申报前先做预归类，可以减少商品编码争议。",
      example_pinyin:
        "Shēnbào qián xiān zuò yù guīlèi, kěyǐ jiǎnshǎo shāngpǐn biānmǎ zhēngyì.",
      example_vi:
        "Phân loại mã HS trước khi khai báo có thể giảm tranh chấp về mã hàng.",
    },
    {
      category: "customs-compliance",
      chinese: "海关估价",
      pinyin: "hǎiguān gūjià",
      meaning_vi: "xác định trị giá hải quan",
      example_cn: "进口商需要准备资料说明海关估价的依据。",
      example_pinyin:
        "Jìnkǒushāng xūyào zhǔnbèi zīliào shuōmíng hǎiguān gūjià de yījù.",
      example_vi:
        "Nhà nhập khẩu cần chuẩn bị tài liệu giải trình căn cứ xác định trị giá hải quan.",
    },
    {
      category: "customs-compliance",
      chinese: "海关稽查",
      pinyin: "hǎiguān jīchá",
      meaning_vi: "kiểm tra sau thông quan",
      example_cn: "企业应妥善保存单据，以便配合海关稽查。",
      example_pinyin:
        "Qǐyè yīng tuǒshàn bǎocún dānjù, yǐbiàn pèihé hǎiguān jīchá.",
      example_vi:
        "Doanh nghiệp cần lưu giữ chứng từ cẩn thận để phối hợp kiểm tra sau thông quan.",
    },
    {
      category: "customs-compliance",
      chinese: "暂时进口",
      pinyin: "zànshí jìnkǒu",
      meaning_vi: "tạm nhập",
      example_cn: "展览设备按暂时进口方式办理海关手续。",
      example_pinyin:
        "Zhǎnlǎn shèbèi àn zànshí jìnkǒu fāngshì bànlǐ hǎiguān shǒuxù.",
      example_vi:
        "Thiết bị triển lãm được làm thủ tục hải quan theo hình thức tạm nhập.",
    },
    {
      category: "customs-compliance",
      chinese: "补税",
      pinyin: "bǔshuì",
      meaning_vi: "nộp bổ sung thuế",
      example_cn: "海关调整税则号后，企业需要按规定补税。",
      example_pinyin:
        "Hǎiguān tiáozhěng shuìzé hào hòu, qǐyè xūyào àn guīdìng bǔshuì.",
      example_vi:
        "Sau khi hải quan điều chỉnh mã thuế, doanh nghiệp cần nộp bổ sung thuế theo quy định.",
    },
  ],
  "trade-documents": [
    {
      category: "trade-documents",
      chinese: "舱单",
      pinyin: "cāngdān",
      meaning_vi: "bản khai hàng hóa, manifest",
      example_cn: "承运人提交舱单后，海关开始核对货物信息。",
      example_pinyin:
        "Chéngyùnrén tíjiāo cāngdān hòu, hǎiguān kāishǐ héduì huòwù xìnxī.",
      example_vi:
        "Sau khi người vận chuyển nộp bản khai hàng hóa, hải quan bắt đầu đối chiếu thông tin lô hàng.",
    },
    {
      category: "trade-documents",
      chinese: "装运通知",
      pinyin: "zhuāngyùn tōngzhī",
      meaning_vi: "thông báo giao hàng",
      example_cn: "货物离港后，卖方应及时发送装运通知。",
      example_pinyin:
        "Huòwù lígǎng hòu, màifāng yīng jíshí fāsòng zhuāngyùn tōngzhī.",
      example_vi:
        "Sau khi hàng rời cảng, bên bán cần gửi thông báo giao hàng kịp thời.",
    },
    {
      category: "trade-documents",
      chinese: "重量单",
      pinyin: "zhòngliàngdān",
      meaning_vi: "phiếu trọng lượng",
      example_cn: "报关资料中的重量单必须与装箱数据一致。",
      example_pinyin:
        "Bàoguān zīliào zhōng de zhòngliàngdān bìxū yǔ zhuāngxiāng shùjù yízhì.",
      example_vi:
        "Phiếu trọng lượng trong hồ sơ khai báo phải khớp với dữ liệu đóng gói.",
    },
    {
      category: "trade-documents",
      chinese: "检验证书",
      pinyin: "jiǎnyàn zhèngshū",
      meaning_vi: "chứng thư kiểm định",
      example_cn: "买方要求随货提供第三方出具的检验证书。",
      example_pinyin:
        "Mǎifāng yāoqiú suíhuò tígōng dìsānfāng chūjù de jiǎnyàn zhèngshū.",
      example_vi:
        "Bên mua yêu cầu gửi kèm chứng thư kiểm định do bên thứ ba cấp.",
    },
  ],
  "tools-materials": [
    {
      category: "tools-materials",
      chinese: "六角扳手",
      pinyin: "liùjiǎo bānshǒu",
      meaning_vi: "khóa lục giác",
      example_cn: "维修人员用六角扳手拧紧机器上的螺栓。",
      example_pinyin:
        "Wéixiū rényuán yòng liùjiǎo bānshǒu nǐngjǐn jīqì shàng de luóshuān.",
      example_vi:
        "Nhân viên bảo trì dùng khóa lục giác để siết chặt bu lông trên máy.",
    },
    {
      category: "tools-materials",
      chinese: "热熔胶枪",
      pinyin: "rèróngjiāo qiāng",
      meaning_vi: "súng bắn keo nóng",
      example_cn: "工人使用热熔胶枪固定包装盒里的零件。",
      example_pinyin:
        "Gōngrén shǐyòng rèróngjiāo qiāng gùdìng bāozhuānghé lǐ de língjiàn.",
      example_vi:
        "Công nhân dùng súng bắn keo nóng để cố định linh kiện trong hộp.",
    },
  ],
  operations: [
    {
      category: "operations",
      chinese: "预热设备",
      pinyin: "yùrè shèbèi",
      meaning_vi: "làm nóng thiết bị trước",
      example_cn: "正式生产前必须先预热设备十分钟。",
      example_pinyin:
        "Zhèngshì shēngchǎn qián bìxū xiān yùrè shèbèi shí fēnzhōng.",
      example_vi:
        "Trước khi sản xuất chính thức phải làm nóng thiết bị trước mười phút.",
    },
    {
      category: "operations",
      chinese: "校准参数",
      pinyin: "jiàozhǔn cānshù",
      meaning_vi: "hiệu chuẩn thông số",
      example_cn: "换线以后技术员需要重新校准参数。",
      example_pinyin:
        "Huànxiàn yǐhòu jìshùyuán xūyào chóngxīn jiàozhǔn cānshù.",
      example_vi:
        "Sau khi đổi dây chuyền, kỹ thuật viên cần hiệu chuẩn lại thông số.",
    },
    {
      category: "operations",
      chinese: "清洁工作台",
      pinyin: "qīngjié gōngzuòtái",
      meaning_vi: "vệ sinh bàn làm việc",
      example_cn: "每批产品完成后都要清洁工作台。",
      example_pinyin:
        "Měi pī chǎnpǐn wánchéng hòu dōu yào qīngjié gōngzuòtái.",
      example_vi:
        "Sau khi hoàn thành mỗi lô sản phẩm đều phải vệ sinh bàn làm việc.",
    },
    {
      category: "operations",
      chinese: "更换模具",
      pinyin: "gēnghuàn mújù",
      meaning_vi: "thay khuôn",
      example_cn: "生产新型号之前需要先更换模具。",
      example_pinyin:
        "Shēngchǎn xīn xínghào zhīqián xūyào xiān gēnghuàn mújù.",
      example_vi:
        "Trước khi sản xuất mẫu mới cần thay khuôn trước.",
    },
    {
      category: "operations",
      chinese: "投入原料",
      pinyin: "tóurù yuánliào",
      meaning_vi: "nạp nguyên liệu",
      example_cn: "确认配方无误后才能投入原料。",
      example_pinyin:
        "Quèrèn pèifāng wúwù hòu cáinéng tóurù yuánliào.",
      example_vi:
        "Chỉ được nạp nguyên liệu sau khi xác nhận công thức không có sai sót.",
    },
  ],
  "defects-maintenance": [
    {
      category: "defects-maintenance",
      chinese: "接触不良",
      pinyin: "jiēchù bùliáng",
      meaning_vi: "tiếp xúc kém",
      example_cn: "设备报警是因为连接器出现接触不良。",
      example_pinyin:
        "Shèbèi bàojǐng shì yīnwèi liánjiēqì chūxiàn jiēchù bùliáng.",
      example_vi:
        "Thiết bị báo lỗi vì đầu nối xuất hiện tình trạng tiếp xúc kém.",
    },
    {
      category: "defects-maintenance",
      chinese: "尺寸偏差",
      pinyin: "chǐcùn piānchā",
      meaning_vi: "sai lệch kích thước",
      example_cn: "这批零件存在尺寸偏差，暂时不能装配。",
      example_pinyin:
        "Zhè pī língjiàn cúnzài chǐcùn piānchā, zànshí bùnéng zhuāngpèi.",
      example_vi:
        "Lô linh kiện này bị sai lệch kích thước nên tạm thời chưa thể lắp ráp.",
    },
    {
      category: "defects-maintenance",
      chinese: "表面凹陷",
      pinyin: "biǎomiàn āoxiàn",
      meaning_vi: "bề mặt bị lõm",
      example_cn: "检验员发现外壳有明显的表面凹陷。",
      example_pinyin:
        "Jiǎnyànyuán fāxiàn wàiké yǒu míngxiǎn de biǎomiàn āoxiàn.",
      example_vi:
        "Nhân viên kiểm tra phát hiện vỏ ngoài có vết lõm bề mặt rõ ràng.",
    },
  ],
};

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function normalizeCard(card: GeneratedCard): GeneratedCard {
  const normalized = {
    category: card.category.trim(),
    chinese: card.chinese.replace(/\s+/g, ""),
    pinyin: card.pinyin.trim().replace(/\s+/g, " "),
    meaning_vi: card.meaning_vi.trim(),
    example_cn: card.example_cn.replace(/\s+/g, ""),
    example_pinyin: card.example_pinyin.trim().replace(/\s+/g, " "),
    example_vi: card.example_vi.trim(),
  };
  return {
    ...normalized,
    ...dataCorrections[normalized.chinese],
  };
}

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return [] satisfies GeneratedCard[];
  }

  const parsed = generatedSchema.parse(
    JSON.parse(fs.readFileSync(cachePath, "utf8")),
  );
  return parsed.items.map(normalizeCard);
}

function saveCache(cards: GeneratedCard[]) {
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ items: cards }, null, 2),
    "utf8",
  );
}

function validateCategory(
  spec: CategorySpec,
  cards: GeneratedCard[],
  excludedWords: Set<string>,
) {
  if (cards.length !== spec.count) {
    throw new Error(
      `${spec.name}: expected ${spec.count} cards, received ${cards.length}.`,
    );
  }

  const normalized = cards.map((card) => ({
    ...normalizeCard(card),
    category: spec.id,
  }));
  const localWords = new Set<string>();

  for (const card of normalized) {
    if (localWords.has(card.chinese) || excludedWords.has(card.chinese)) {
      throw new Error(`${spec.name}: duplicate word ${card.chinese}.`);
    }

    if (!toneMarkPattern.test(card.pinyin)) {
      throw new Error(`${card.chinese}: target pinyin has no tone marks.`);
    }

    if (!card.example_cn.includes(card.chinese)) {
      throw new Error(
        `${card.chinese}: example does not contain the target word.`,
      );
    }

    if (!/[。！？]$/u.test(card.example_cn)) {
      throw new Error(`${card.chinese}: example is missing Chinese punctuation.`);
    }

    if (!toneMarkPattern.test(card.example_pinyin)) {
      throw new Error(`${card.chinese}: example pinyin has no tone marks.`);
    }

    if (!vietnameseAccentPattern.test(card.example_vi)) {
      throw new Error(`${card.chinese}: Vietnamese text is missing accents.`);
    }

    localWords.add(card.chinese);
  }

  if (new Set(normalized.map((card) => card.example_cn)).size !== spec.count) {
    throw new Error(`${spec.name}: example sentences must be unique.`);
  }

  return normalized;
}

async function generateCategory(
  openai: OpenAI,
  spec: CategorySpec,
  excludedWords: string[],
) {
  const collected = new Map<string, GeneratedCard>();

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const remaining = spec.count - collected.size;

    if (remaining <= 0) {
      break;
    }

    const requestCount = remaining <= 5 ? 5 : remaining;

    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: isLogisticsTemplate
              ? "logistics_vocabulary_cards"
              : isConstructionTemplate
                ? "construction_vocabulary_cards"
                : "factory_vocabulary_cards",
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
                      "chinese",
                      "pinyin",
                      "meaning_vi",
                      "example_cn",
                      "example_pinyin",
                      "example_vi",
                    ],
                    properties: {
                      category: { type: "string" },
                      chinese: { type: "string" },
                      pinyin: { type: "string" },
                      meaning_vi: { type: "string" },
                      example_cn: { type: "string" },
                      example_pinyin: { type: "string" },
                      example_vi: { type: "string" },
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
            content: isLogisticsTemplate
              ? "Bạn là giáo viên tiếng Trung thương mại chuyên đào tạo người Việt làm xuất nhập khẩu và logistics. Hãy tạo đúng số lượng từ vựng tiếng Trung giản thể thực tế, chuẩn nghiệp vụ và dùng được trong công việc. Mỗi mục phải là một từ hoặc cụm từ chuyên môn hữu ích, không phải cả câu; tránh từ quá cơ bản và tránh trùng khái niệm giữa các nhóm. Pinyin của từ và câu phải có dấu thanh đầy đủ, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu và chính xác về nghiệp vụ. Câu ví dụ phải dài khoảng 8-26 chữ Hán, chứa nguyên văn liên tục từ mục tiêu và mô tả một tình huống cụ thể về mua hàng, hợp đồng, Incoterms, chứng từ, hải quan, kho bãi, đóng gói, vận tải, giao nhận hoặc xử lý sự cố. Không tự đặt tên công ty, mã đơn, số container hay mức giá cụ thể. Không đưa lời khuyên pháp lý tuyệt đối và không dùng các câu chung chung lặp khuôn. Giữ category đúng id được yêu cầu."
              : isConstructionTemplate
                ? "Bạn là giáo viên tiếng Trung chuyên ngành xây dựng cho người Việt làm việc tại công trường. Hãy tạo đúng số lượng từ vựng tiếng Trung giản thể thực tế, chuẩn nghiệp vụ và dùng được trong công việc. Mỗi mục phải là một từ hoặc cụm từ chuyên môn hữu ích, không phải cả câu; tránh từ quá cơ bản và tránh trùng khái niệm giữa các nhóm. Pinyin của từ và câu phải có dấu thanh đầy đủ, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu và chính xác về xây dựng. Câu ví dụ phải dài khoảng 8-26 chữ Hán, chứa nguyên văn liên tục từ mục tiêu và mô tả một tình huống cụ thể về công trường, vật liệu, dụng cụ, máy thi công, bản vẽ, trắc địa, nền móng, kết cấu, bê tông, điện nước, hoàn thiện, chất lượng, an toàn, tiến độ hoặc nghiệm thu. Không tự đặt tên công ty, mã dự án, địa chỉ, kích thước hay khối lượng cụ thể. Không đưa hướng dẫn nguy hiểm trái quy trình an toàn, không đưa lời khuyên kỹ thuật tuyệt đối và không dùng câu chung chung lặp khuôn. Giữ category đúng id được yêu cầu."
                : "Bạn là giáo viên tiếng Trung chuyên ngành sản xuất cho công nhân và kỹ sư người Việt. Hãy tạo đúng số lượng từ vựng tiếng Trung giản thể thực tế trong nhà máy. Mỗi mục phải là một từ hoặc cụm từ chuyên môn hữu ích, không phải cả câu. Pinyin của từ và của câu phải có dấu thanh đầy đủ. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu. Câu ví dụ phải dài khoảng 8-24 chữ Hán, chứa nguyên văn từ mục tiêu và mô tả một tình huống nhà xưởng cụ thể. Không dùng các câu chung chung lặp khuôn. Giữ category đúng id được yêu cầu.",
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
              topics_that_must_be_well_represented: spec.requiredTopics,
              forbidden_duplicate_chinese_words: [
                ...excludedWords,
                ...collected.keys(),
              ],
            }),
          },
        ],
      });
      const content = completion.choices[0]?.message.content;

      if (!content) {
        throw new Error("OpenAI returned an empty response.");
      }

      const response = generatedSchema.parse(JSON.parse(content));
      const forbidden = new Set(excludedWords);

      for (const rawCard of response.items) {
        if (collected.size >= spec.count) {
          break;
        }

        const card = {
          ...normalizeCard(rawCard),
          category: spec.id,
        };
        const rejectionReason =
          (forbidden.has(card.chinese) && "already used in another category") ||
          (collected.has(card.chinese) && "duplicate in this category") ||
          (!toneMarkPattern.test(card.pinyin) &&
            "target pinyin has no tone marks") ||
          (!card.example_cn.includes(card.chinese) &&
            "example is missing the target word") ||
          (!/[。！？]$/u.test(card.example_cn) &&
            "example is missing Chinese punctuation") ||
          (!toneMarkPattern.test(card.example_pinyin) &&
            "example pinyin has no tone marks") ||
          (!vietnameseAccentPattern.test(card.example_vi) &&
            "Vietnamese example has no accents");

        if (rejectionReason) {
          console.warn(
            `[data] Skipped ${card.chinese || "(blank)"}: ${rejectionReason}.`,
          );
          continue;
        }

        collected.set(card.chinese, card);
      }

      console.log(
        `[data] ${spec.name}: collected ${collected.size}/${spec.count}.`,
      );

      if (
        collected.size < spec.count &&
        (fallbackCards[spec.id]?.length || 0) >= spec.count - collected.size
      ) {
        break;
      }
    } catch (error) {
      console.warn(
        `Retrying ${spec.id} (${attempt}/8):`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  for (const fallback of fallbackCards[spec.id] || []) {
    if (
      collected.size >= spec.count ||
      excludedWords.includes(fallback.chinese) ||
      collected.has(fallback.chinese)
    ) {
      continue;
    }

    collected.set(fallback.chinese, normalizeCard(fallback));
    console.log(`[data] Added fallback term ${fallback.chinese}.`);
  }

  return validateCategory(spec, Array.from(collected.values()), new Set(excludedWords));
}

async function buildVocabulary() {
  const expectedTotal = categories.reduce(
    (total, category) => total + category.count,
    0,
  );

  if (expectedTotal !== 300) {
    throw new Error(`Category counts must total 300, received ${expectedTotal}.`);
  }

  let cached = readCache();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 180_000,
  });

  for (const spec of categories) {
    const cachedCategory = cached.filter((card) => card.category === spec.id);
    const cardsOutsideCategory = cached.filter(
      (card) => card.category !== spec.id,
    );
    const excludedWords = new Set(
      cardsOutsideCategory.map((card) => card.chinese),
    );

    try {
      validateCategory(spec, cachedCategory, excludedWords);
      console.log(`[data] Reusing ${spec.name}: ${spec.count} words.`);
      continue;
    } catch {
      cached = cardsOutsideCategory;
    }

    const generated = await generateCategory(
      openai,
      spec,
      cached.map((card) => card.chinese),
    );
    cached.push(...generated);
    saveCache(cached);
    console.log(`[data] Generated ${spec.name}: ${generated.length} words.`);
  }

  const ordered = categories.flatMap((spec) =>
    cached.filter((card) => card.category === spec.id),
  );

  if (
    ordered.length !== 300 ||
    new Set(ordered.map((card) => card.chinese)).size !== 300 ||
    new Set(ordered.map((card) => card.example_cn)).size !== 300
  ) {
    throw new Error(
      `${templateName} must contain 300 unique complete cards.`,
    );
  }

  return ordered;
}

async function buildCards(vocabulary: GeneratedCard[]) {
  async function createCard(card: GeneratedCard, index: number) {
    const position = index + 1;
    console.log(`[audio ${position}/${vocabulary.length}] ${card.chinese}`);
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      getOrCreateTemplateSpeech(templateSlug, "word", card.chinese),
      getOrCreateTemplateSpeech(templateSlug, "sentence", card.example_cn),
    ]);

    if (!wordAudioUrl || !sentenceAudioUrl) {
      throw new Error(`Could not create complete audio for ${card.chinese}.`);
    }

    return {
      ...card,
      position,
      wordAudioUrl,
      sentenceAudioUrl,
    } satisfies FactoryCard;
  }

  const cards: FactoryCard[] = [];

  for (
    let index = 0;
    index < vocabulary.length;
    index += audioConcurrency
  ) {
    const completed = await Promise.all(
      vocabulary
        .slice(index, index + audioConcurrency)
        .map((card, offset) => createCard(card, index + offset)),
    );
    cards.push(...completed);
  }

  return cards;
}

function buildMigration(cards: FactoryCard[]) {
  const values = cards
    .map(
      (card) =>
        `    (${[
          card.chinese,
          card.pinyin,
          card.meaning_vi,
          card.example_cn,
          card.example_pinyin,
          card.example_vi,
          card.wordAudioUrl,
          card.sentenceAudioUrl,
        ]
          .map(sqlLiteral)
          .join(", ")}, ${card.position})`,
    )
    .join(",\n");
  const activeWords = cards
    .map((card) => sqlLiteral(card.chinese))
    .join(", ");

  return `-- Add a reusable 300-word Chinese professional deck with pre-generated audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  ${sqlLiteral(templateName)},
  ${sqlLiteral(templateDescription)},
  ${sqlLiteral(templateLevel)}
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id
  from public.template_decks
  where slug = '${templateSlug}'
)
insert into public.template_cards (
  template_deck_id,
  chinese,
  pinyin,
  meaning_vi,
  example_cn,
  example_pinyin,
  example_vi,
  word_audio_url,
  sentence_audio_url,
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
  card.word_audio_url,
  card.sentence_audio_url,
  card.position
from target_deck
cross join (
  values
${values}
) as card(
  chinese,
  pinyin,
  meaning_vi,
  example_cn,
  example_pinyin,
  example_vi,
  word_audio_url,
  sentence_audio_url,
  position
)
on conflict (template_deck_id, chinese) do update
set
  pinyin = excluded.pinyin,
  meaning_vi = excluded.meaning_vi,
  example_cn = excluded.example_cn,
  example_pinyin = excluded.example_pinyin,
  example_vi = excluded.example_vi,
  word_audio_url = excluded.word_audio_url,
  sentence_audio_url = excluded.sentence_audio_url,
  position = excluded.position;

delete from public.template_cards
where template_deck_id = (
  select id from public.template_decks where slug = '${templateSlug}'
)
and chinese not in (${activeWords});
`;
}

async function syncTemplate(cards: FactoryCard[]) {
  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("template_decks")
    .upsert(
      {
        slug: templateSlug,
        name: templateName,
        description: templateDescription,
        level: templateLevel,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (deckError || !deck) {
    throw deckError || new Error("Không thể tạo bộ thẻ mẫu.");
  }

  const rows = cards.map((card) => ({
    template_deck_id: deck.id,
    chinese: card.chinese,
    pinyin: card.pinyin,
    meaning_vi: card.meaning_vi,
    example_cn: card.example_cn,
    example_pinyin: card.example_pinyin,
    example_vi: card.example_vi,
    word_audio_url: card.wordAudioUrl,
    sentence_audio_url: card.sentenceAudioUrl,
    position: card.position,
  }));

  for (let index = 0; index < rows.length; index += 50) {
    const { error } = await supabase
      .from("template_cards")
      .upsert(rows.slice(index, index + 50), {
        onConflict: "template_deck_id,chinese",
      });
    if (error) {
      throw error;
    }
  }

  const activeWords = new Set(cards.map((card) => card.chinese));
  const { data: existingCards, error: existingError } = await supabase
    .from("template_cards")
    .select("id,chinese")
    .eq("template_deck_id", deck.id);
  if (existingError) {
    throw existingError;
  }

  const staleCardIds = (existingCards || [])
    .filter((card) => !activeWords.has(card.chinese))
    .map((card) => card.id);
  if (staleCardIds.length > 0) {
    const { error } = await supabase
      .from("template_cards")
      .delete()
      .in("id", staleCardIds);
    if (error) {
      throw error;
    }
  }

  const { count, error: countError } = await supabase
    .from("template_cards")
    .select("id", { count: "exact", head: true })
    .eq("template_deck_id", deck.id);
  if (countError) {
    throw countError;
  }
  if (count !== cards.length) {
    throw new Error(
      `Supabase cần có ${cards.length} thẻ, hiện đang có ${count ?? 0}.`,
    );
  }

  const activeAudioFiles = new Set(
    cards.flatMap((card) => [
      new URL(card.wordAudioUrl).pathname.split("/").at(-1),
      new URL(card.sentenceAudioUrl).pathname.split("/").at(-1),
    ]),
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
    `[sync] Đã đồng bộ ${count} thẻ; dọn ${staleCardIds.length} thẻ và ${staleAudioPaths.length} audio cũ.`,
  );
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const vocabulary = await buildVocabulary();
  const cards = await buildCards(vocabulary);
  fs.writeFileSync(outputPath, buildMigration(cards), "utf8");
  await syncTemplate(cards);
  console.log(`Đã tạo ${outputPath} với ${cards.length} thẻ đầy đủ.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
