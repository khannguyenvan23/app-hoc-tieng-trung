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
const isCommercialTemplate = process.argv.includes("--commercial");
const isElectronicsTemplate = process.argv.includes("--electronics");
const templateSlug = isElectronicsTemplate
  ? "dien-tu-linh-kien-kiem-tra-chat-luong-300-tu"
  : isCommercialTemplate
    ? "thuong-mai-hop-dong-dam-phan-300-tu"
    : isLogisticsTemplate
    ? "xuat-nhap-khau-logistics-300-tu"
    : isConstructionTemplate
      ? "xay-dung-cong-trinh-300-tu"
      : "nha-may-xuong-300";
const templateName = isElectronicsTemplate
  ? "Điện tử, linh kiện và kiểm tra chất lượng - 300 từ"
  : isCommercialTemplate
    ? "Tiếng Trung thương mại, hợp đồng và đàm phán - 300 từ"
    : isLogisticsTemplate
    ? "Xuất nhập khẩu và logistics - 300 từ"
    : isConstructionTemplate
      ? "Tiếng Trung xây dựng và công trình - 300 từ"
      : "Tiếng Trung nhà máy/xưởng - 300 từ";
const templateDescription = isElectronicsTemplate
  ? "300 từ vựng tiếng Trung thực tế về bo mạch, linh kiện điện tử, cảm biến, nguồn điện, SMT, hàn, lắp ráp, thiết bị đo, kiểm tra chất lượng, lỗi linh kiện và chống tĩnh điện. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ thực tế và hai audio tạo sẵn."
  : isCommercialTemplate
    ? "300 từ vựng tiếng Trung thực tế về thị trường, khách hàng, sản phẩm, báo giá, thương lượng, hợp đồng, thanh toán, công nợ, đại lý, hậu mãi, khiếu nại và thương mại điện tử. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ thực tế và hai audio tạo sẵn."
    : isLogisticsTemplate
    ? "300 từ vựng tiếng Trung thực tế về mua hàng, hợp đồng, Incoterms, chứng từ, hải quan, kho bãi, đóng gói, vận tải, giao nhận và xử lý sự cố. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ thực tế và hai audio tạo sẵn."
    : isConstructionTemplate
      ? "300 từ vựng tiếng Trung thực tế về vật liệu, dụng cụ, máy thi công, bản vẽ, kết cấu, điện nước, hoàn thiện, tiến độ, nghiệm thu và an toàn công trình. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ thực tế và hai audio tạo sẵn."
      : "300 từ vựng tiếng Trung thực tế về máy móc, dây chuyền, thao tác sản xuất, kiểm tra chất lượng, lỗi sản phẩm, bảo trì, kho vận và an toàn lao động. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và audio tạo sẵn.";
const templateLevel = isElectronicsTemplate
  ? "Điện tử"
  : isCommercialTemplate
    ? "Thương mại"
    : isLogisticsTemplate
    ? "Logistics"
    : isConstructionTemplate
      ? "Xây dựng"
      : "Nhà máy";
const outputPath = isElectronicsTemplate
  ? "supabase/migrations/055_electronics_components_quality_300_words.sql"
  : isCommercialTemplate
    ? "supabase/migrations/052_commercial_contract_negotiation_300_words.sql"
    : isLogisticsTemplate
    ? "supabase/migrations/049_logistics_import_export_300_words.sql"
    : isConstructionTemplate
      ? "supabase/migrations/051_construction_300_words.sql"
      : "supabase/migrations/039_factory_300_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  isElectronicsTemplate
    ? "tiengtrunghihi-electronics-components-quality-300-cards.json"
    : isCommercialTemplate
      ? "tiengtrunghihi-commercial-contract-negotiation-300-cards.json"
      : isLogisticsTemplate
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

const commercialCategories: CategorySpec[] = [
  {
    id: "market-customers",
    name: "Thị trường và khách hàng",
    count: 30,
    scope:
      "Từ vựng dùng để nghiên cứu thị trường, xác định khách hàng mục tiêu, tìm kiếm cơ hội kinh doanh và quản lý quan hệ khách hàng.",
    requiredTopics: [
      "nghiên cứu thị trường",
      "khách hàng mục tiêu",
      "nhu cầu khách hàng",
      "phân khúc thị trường",
      "thị phần",
      "đối thủ cạnh tranh",
      "khách hàng tiềm năng",
      "khách hàng cũ",
      "dữ liệu khách hàng",
      "cơ hội kinh doanh",
      "mức độ hài lòng",
      "duy trì khách hàng",
    ],
  },
  {
    id: "products-pricing",
    name: "Sản phẩm, giá và báo giá",
    count: 30,
    scope:
      "Thông tin sản phẩm, bảng giá, báo giá, cấu thành giá và cách trình bày phương án thương mại cho khách hàng.",
    requiredTopics: [
      "danh mục sản phẩm",
      "quy cách sản phẩm",
      "mẫu sản phẩm",
      "giá niêm yết",
      "giá bán",
      "giá vốn",
      "bảng giá",
      "báo giá",
      "thời hạn báo giá",
      "chi phí bổ sung",
      "lợi nhuận",
      "chính sách giá",
    ],
  },
  {
    id: "negotiation-discounts",
    name: "Thương lượng và chiết khấu",
    count: 30,
    scope:
      "Từ vựng thực tế khi thương lượng giá, số lượng, thời hạn, ưu đãi và tìm phương án hai bên cùng chấp nhận.",
    requiredTopics: [
      "thương lượng",
      "điều chỉnh giá",
      "mức chiết khấu",
      "giá ưu đãi",
      "nhượng bộ",
      "đề xuất",
      "phản hồi",
      "điều kiện tiên quyết",
      "phương án thay thế",
      "đạt đồng thuận",
      "giới hạn ngân sách",
      "quyền quyết định",
    ],
  },
  {
    id: "contracts-terms",
    name: "Hợp đồng và điều khoản",
    count: 30,
    scope:
      "Soạn thảo, rà soát, ký kết, sửa đổi và thực hiện hợp đồng mua bán cùng các điều khoản thương mại phổ biến.",
    requiredTopics: [
      "hợp đồng mua bán",
      "bên mua",
      "bên bán",
      "điều khoản hợp đồng",
      "thời hạn hiệu lực",
      "phụ lục hợp đồng",
      "sửa đổi hợp đồng",
      "ký kết",
      "đóng dấu",
      "nghĩa vụ hợp đồng",
      "vi phạm hợp đồng",
      "chấm dứt hợp đồng",
      "bảo mật thông tin",
    ],
  },
  {
    id: "orders-payment",
    name: "Đơn hàng và thanh toán",
    count: 30,
    scope:
      "Tạo, xác nhận và điều chỉnh đơn hàng; đặt cọc, thanh toán, hoàn tiền và theo dõi trạng thái giao dịch.",
    requiredTopics: [
      "đơn đặt hàng",
      "xác nhận đơn hàng",
      "số lượng đặt mua",
      "thay đổi đơn hàng",
      "hủy đơn",
      "tiền đặt cọc",
      "thanh toán trước",
      "thanh toán phần còn lại",
      "chuyển khoản",
      "phương thức thanh toán",
      "thời hạn thanh toán",
      "hoàn tiền",
    ],
  },
  {
    id: "invoices-reconciliation",
    name: "Hóa đơn, công nợ và đối soát",
    count: 30,
    scope:
      "Xuất hóa đơn, lập chứng từ thanh toán, quản lý khoản phải thu, nhắc nợ và đối chiếu số liệu giữa hai bên.",
    requiredTopics: [
      "hóa đơn",
      "hóa đơn điện tử",
      "phiếu thu",
      "biên lai",
      "công nợ",
      "khoản phải thu",
      "khoản quá hạn",
      "nhắc thanh toán",
      "đối soát",
      "đối chiếu số liệu",
      "số dư",
      "xác nhận công nợ",
    ],
  },
  {
    id: "partners-channels",
    name: "Đối tác, đại lý và kênh bán",
    count: 30,
    scope:
      "Tìm kiếm và quản lý nhà phân phối, đại lý, đối tác bán hàng, khu vực kinh doanh và chính sách kênh.",
    requiredTopics: [
      "đối tác kinh doanh",
      "nhà phân phối",
      "đại lý",
      "đại lý độc quyền",
      "kênh bán hàng",
      "khu vực phụ trách",
      "chính sách đại lý",
      "hoa hồng",
      "doanh số",
      "chỉ tiêu bán hàng",
      "hỗ trợ bán hàng",
      "đào tạo sản phẩm",
    ],
  },
  {
    id: "delivery-after-sales",
    name: "Giao hàng và hậu mãi",
    count: 30,
    scope:
      "Hẹn giao hàng, kiểm nhận, bảo hành, bảo trì, đổi trả và theo dõi chất lượng dịch vụ sau bán.",
    requiredTopics: [
      "ngày giao hàng",
      "giao đúng hạn",
      "ký nhận",
      "kiểm nhận hàng",
      "biên bản giao nhận",
      "dịch vụ hậu mãi",
      "thời hạn bảo hành",
      "phiếu bảo hành",
      "bảo trì",
      "đổi hàng",
      "trả hàng",
      "hỗ trợ kỹ thuật",
    ],
  },
  {
    id: "complaints-disputes",
    name: "Khiếu nại, tranh chấp và bồi thường",
    count: 30,
    scope:
      "Tiếp nhận phản ánh, xác minh trách nhiệm, đề xuất khắc phục và giải quyết tranh chấp thương mại một cách chuyên nghiệp.",
    requiredTopics: [
      "khiếu nại khách hàng",
      "phản ánh chất lượng",
      "sản phẩm lỗi",
      "thiếu số lượng",
      "giao sai hàng",
      "xác minh nguyên nhân",
      "trách nhiệm",
      "phương án khắc phục",
      "bồi thường",
      "thỏa thuận giải quyết",
      "tranh chấp thương mại",
      "hòa giải",
    ],
  },
  {
    id: "ecommerce-wechat",
    name: "Thương mại điện tử và WeChat",
    count: 30,
    scope:
      "Bán hàng trên nền tảng số, tư vấn qua WeChat, quản lý gian hàng, chương trình khuyến mại và dữ liệu chuyển đổi.",
    requiredTopics: [
      "thương mại điện tử",
      "gian hàng trực tuyến",
      "đơn hàng trực tuyến",
      "tư vấn qua WeChat",
      "nhóm khách hàng",
      "mã QR",
      "thanh toán di động",
      "khuyến mại",
      "phiếu giảm giá",
      "lượt truy cập",
      "tỷ lệ chuyển đổi",
      "đánh giá của khách hàng",
      "phát trực tiếp bán hàng",
    ],
  },
];

const electronicsCategories: CategorySpec[] = [
  {
    id: "electronic-components",
    name: "Linh kiện điện tử cơ bản",
    count: 30,
    scope:
      "Tên gọi và đặc tính của các linh kiện thụ động, bán dẫn, vi mạch và đầu nối thường gặp trên bo mạch điện tử.",
    requiredTopics: [
      "điện trở",
      "tụ điện",
      "cuộn cảm",
      "điốt",
      "điốt phát quang",
      "transistor",
      "MOSFET",
      "mạch tích hợp",
      "vi điều khiển",
      "rơ le",
      "cầu chì",
      "thạch anh",
      "đầu nối",
      "công tắc",
      "biến trở",
    ],
  },
  {
    id: "pcb-structure-design",
    name: "Bo mạch và cấu trúc PCB",
    count: 30,
    scope:
      "Vật liệu, lớp mạch, đường dẫn, điểm hàn và dữ liệu kỹ thuật dùng trong thiết kế và sản xuất PCB.",
    requiredTopics: [
      "bo mạch in",
      "bo mạch mềm",
      "tấm nền",
      "lớp đồng",
      "đường mạch",
      "lỗ xuyên",
      "lỗ mù",
      "mặt nạ hàn",
      "ký hiệu in",
      "miếng hàn",
      "bo mạch hai lớp",
      "bo mạch nhiều lớp",
      "sơ đồ nguyên lý",
      "danh sách vật liệu",
      "tệp Gerber",
    ],
  },
  {
    id: "power-voltage-circuits",
    name: "Nguồn điện, điện áp và mạch điện",
    count: 30,
    scope:
      "Các đại lượng điện, loại nguồn, chuyển đổi điện áp, bảo vệ mạch và trạng thái điện thường dùng khi lắp ráp và kiểm tra.",
    requiredTopics: [
      "điện áp",
      "dòng điện",
      "điện trở",
      "công suất",
      "nguồn điện",
      "dòng điện một chiều",
      "dòng điện xoay chiều",
      "bộ đổi nguồn",
      "bộ ổn áp",
      "nối đất",
      "cực dương",
      "cực âm",
      "ngắn mạch",
      "quá áp",
      "sụt áp",
    ],
  },
  {
    id: "sensors-signals",
    name: "Cảm biến và tín hiệu",
    count: 30,
    scope:
      "Cảm biến công nghiệp, tín hiệu đầu vào và đầu ra, tín hiệu số hoặc tương tự cùng hoạt động hiệu chuẩn.",
    requiredTopics: [
      "cảm biến",
      "cảm biến nhiệt độ",
      "cảm biến áp suất",
      "cảm biến quang điện",
      "cảm biến tiệm cận",
      "cảm biến Hall",
      "bộ mã hóa",
      "tín hiệu đầu vào",
      "tín hiệu đầu ra",
      "tín hiệu tương tự",
      "tín hiệu số",
      "xung tín hiệu",
      "nhiễu tín hiệu",
      "độ nhạy",
      "hiệu chuẩn",
    ],
  },
  {
    id: "smt-assembly",
    name: "SMT và lắp ráp bo mạch",
    count: 30,
    scope:
      "Thiết bị, vật tư và công đoạn gắn linh kiện bề mặt, cắm linh kiện, hàn lại và kiểm tra sau lắp ráp.",
    requiredTopics: [
      "công nghệ gắn bề mặt",
      "linh kiện gắn bề mặt",
      "máy gắp đặt",
      "kem hàn",
      "khuôn in kem hàn",
      "máy in kem hàn",
      "lò hàn lại",
      "hàn sóng",
      "linh kiện cắm",
      "máy cấp liệu",
      "khay linh kiện",
      "cuộn linh kiện",
      "chiều cực tính",
      "kiểm tra quang học tự động",
      "bo mạch đã lắp ráp",
    ],
  },
  {
    id: "soldering-rework",
    name: "Hàn, tháo hàn và sửa chữa",
    count: 30,
    scope:
      "Dụng cụ, vật liệu, thao tác và lỗi thường gặp trong hàn tay, tháo linh kiện và sửa lại bo mạch.",
    requiredTopics: [
      "mỏ hàn",
      "dây thiếc",
      "kem trợ hàn",
      "điểm hàn",
      "hàn nguội",
      "cầu hàn",
      "thiếu thiếc",
      "thừa thiếc",
      "tháo hàn",
      "dây hút thiếc",
      "máy khò nóng",
      "sửa lại",
      "thay linh kiện",
      "làm sạch đầu hàn",
      "nhiệt độ hàn",
    ],
  },
  {
    id: "measurement-testing",
    name: "Thiết bị đo và kiểm thử",
    count: 30,
    scope:
      "Thiết bị đo điện, đầu dò, đồ gá và phép kiểm thử dùng để xác nhận chức năng và thông số của bo mạch.",
    requiredTopics: [
      "đồng hồ vạn năng",
      "máy hiện sóng",
      "máy đo LCR",
      "nguồn điện lập trình",
      "máy phân tích phổ",
      "đầu dò",
      "đồ gá kiểm tra",
      "điểm kiểm tra",
      "đo thông mạch",
      "đo cách điện",
      "kiểm tra chức năng",
      "kiểm tra trong mạch",
      "kiểm tra bay kim",
      "giá trị đo",
      "sai số đo",
    ],
  },
  {
    id: "quality-inspection",
    name: "Kiểm tra và quản lý chất lượng",
    count: 30,
    scope:
      "Hoạt động kiểm tra đầu vào, trong quá trình, đầu ra, lấy mẫu, tiêu chuẩn chấp nhận và truy xuất chất lượng.",
    requiredTopics: [
      "kiểm tra đầu vào",
      "kiểm tra trong quá trình",
      "kiểm tra đầu ra",
      "kiểm tra ngoại quan",
      "kiểm tra kích thước",
      "lấy mẫu",
      "mức chất lượng chấp nhận",
      "tiêu chuẩn kiểm tra",
      "giới hạn trên",
      "giới hạn dưới",
      "kết quả đạt",
      "kết quả không đạt",
      "cách ly sản phẩm lỗi",
      "truy xuất nguồn gốc",
      "báo cáo kiểm tra",
    ],
  },
  {
    id: "component-defects",
    name: "Lỗi linh kiện và bo mạch",
    count: 30,
    scope:
      "Tên lỗi điện, lỗi cơ học, lỗi lắp ráp và biểu hiện bất thường thường gặp khi phân tích bo mạch không đạt.",
    requiredTopics: [
      "hở mạch",
      "ngắn mạch",
      "rò điện",
      "trôi thông số",
      "cháy linh kiện",
      "nứt linh kiện",
      "chân linh kiện cong",
      "chân linh kiện gãy",
      "linh kiện lỏng",
      "oxy hóa",
      "lệch vị trí",
      "thiếu linh kiện",
      "lắp ngược linh kiện",
      "sai linh kiện",
      "bo mạch cong vênh",
    ],
  },
  {
    id: "esd-packaging-storage",
    name: "Chống tĩnh điện, đóng gói và bảo quản",
    count: 30,
    scope:
      "Thiết bị và quy trình ESD, vật liệu đóng gói, kiểm soát độ ẩm, nhãn lô và bảo quản linh kiện điện tử.",
    requiredTopics: [
      "tĩnh điện",
      "phóng tĩnh điện",
      "vòng đeo tay chống tĩnh điện",
      "thảm chống tĩnh điện",
      "túi chống tĩnh điện",
      "khay linh kiện",
      "cuộn linh kiện",
      "linh kiện nhạy ẩm",
      "thẻ chỉ thị độ ẩm",
      "gói hút ẩm",
      "tủ chống ẩm",
      "sấy linh kiện",
      "nhãn lô",
      "mã ngày sản xuất",
      "điều kiện bảo quản",
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

const categories = isElectronicsTemplate
  ? electronicsCategories
  : isCommercialTemplate
    ? commercialCategories
    : isLogisticsTemplate
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
const commercialDataCorrections: Record<
  string,
  Partial<GeneratedCard>
> = {
  合同模版: {
    chinese: "合同模板",
    pinyin: "hétóng múbǎn",
    meaning_vi: "mẫu hợp đồng",
    example_cn: "公司提供的合同模板适用于一般买卖业务。",
    example_pinyin:
      "Gōngsī tígōng de hétóng múbǎn shìyòng yú yìbān mǎimài yèwù.",
    example_vi:
      "Mẫu hợp đồng do công ty cung cấp phù hợp với các giao dịch mua bán thông thường.",
  },
  秒付功能: {
    chinese: "快捷支付",
    pinyin: "kuàijié zhīfù",
    meaning_vi: "thanh toán nhanh",
    example_cn: "小程序支持快捷支付，客户下单后可以直接付款。",
    example_pinyin:
      "Xiǎochéngxù zhīchí kuàijié zhīfù, kèhù xiàdān hòu kěyǐ zhíjiē fùkuǎn.",
    example_vi:
      "Ứng dụng mini hỗ trợ thanh toán nhanh để khách có thể trả tiền ngay sau khi đặt hàng.",
  },
  客户私域流量: {
    chinese: "私域流量",
    pinyin: "sīyù liúliàng",
    meaning_vi: "lưu lượng khách hàng trên kênh riêng",
    example_cn: "品牌通过微信群运营私域流量，提高客户复购率。",
    example_pinyin:
      "Pǐnpái tōngguò Wēixìn qún yùnyíng sīyù liúliàng, tígāo kèhù fùgòulǜ.",
    example_vi:
      "Thương hiệu vận hành tệp khách hàng trên kênh riêng qua nhóm WeChat để tăng tỷ lệ mua lại.",
  },
};
const electronicsDataCorrections: Record<
  string,
  Partial<GeneratedCard>
> = {
  薄膜电阻器: {
    chinese: "厚膜电阻",
    pinyin: "hòumó diànzǔ",
    meaning_vi: "điện trở màng dày",
    example_cn: "厚膜电阻常用于需要控制成本的控制电路。",
    example_pinyin:
      "Hòumó diànzǔ cháng yòng yú xūyào kòngzhì chéngběn de kòngzhì diànlù.",
    example_vi:
      "Điện trở màng dày thường được dùng trong các mạch điều khiển cần tối ưu chi phí.",
  },
  钽质电容器: {
    chinese: "陶瓷电容器",
    pinyin: "táocí diànróngqì",
    meaning_vi: "tụ điện gốm",
    example_cn: "陶瓷电容器适合用于高频滤波电路。",
    example_pinyin:
      "Táocí diànróngqì shìhé yòng yú gāopín lǜbō diànlù.",
    example_vi: "Tụ điện gốm phù hợp dùng trong mạch lọc tần số cao.",
  },
  焊接热槽: {
    chinese: "沉金工艺",
    pinyin: "chénjīn gōngyì",
    meaning_vi: "quy trình mạ vàng hóa học",
    example_cn: "沉金工艺可以提高焊盘的平整度和抗氧化能力。",
    example_pinyin:
      "Chénjīn gōngyì kěyǐ tígāo hànpán de píngzhěngdù hé kàng yǎnghuà nénglì.",
    example_vi:
      "Quy trình mạ vàng hóa học giúp tăng độ phẳng và khả năng chống oxy hóa của pad hàn.",
  },
  饱和传感器: {
    chinese: "传感器饱和",
    pinyin: "chuángǎnqì bǎohé",
    meaning_vi: "cảm biến bị bão hòa",
    example_cn: "输入信号过强时可能出现传感器饱和。",
    example_pinyin:
      "Shūrù xìnhào guò qiáng shí kěnéng chūxiàn chuángǎnqì bǎohé.",
    example_vi:
      "Khi tín hiệu đầu vào quá mạnh, cảm biến có thể rơi vào trạng thái bão hòa.",
  },
  贴片测试探头: {
    chinese: "SMT测试探针",
    pinyin: "SMT cèshì tànzhēn",
    meaning_vi: "kim dò kiểm tra SMT",
    example_cn: "SMT测试探针必须准确接触测试点。",
    example_pinyin:
      "SMT cèshì tànzhēn bìxū zhǔnquè jiēchù cèshìdiǎn.",
    example_vi: "Kim dò kiểm tra SMT phải tiếp xúc chính xác với điểm đo.",
  },
  巡检抽检: {
    chinese: "过程巡检",
    pinyin: "guòchéng xúnjiǎn",
    meaning_vi: "kiểm tra tuần tra trong quá trình",
    example_cn: "IPQC通过过程巡检及时发现生产异常。",
    example_pinyin:
      "IPQC tōngguò guòchéng xúnjiǎn jíshí fāxiàn shēngchǎn yìcháng.",
    example_vi:
      "IPQC kiểm tra tuần tra trong quá trình để kịp thời phát hiện bất thường sản xuất.",
  },
  接收质量水平: {
    chinese: "接收质量限",
    pinyin: "jiēshōu zhìliàng xiàn",
    meaning_vi: "giới hạn chất lượng chấp nhận",
    example_cn: "抽样检验结果必须符合接收质量限。",
    example_pinyin:
      "Chōuyàng jiǎnyàn jiéguǒ bìxū fúhé jiēshōu zhìliàng xiàn.",
    example_vi:
      "Kết quả kiểm tra lấy mẫu phải đáp ứng giới hạn chất lượng chấp nhận.",
  },
  桥连焊点: {
    chinese: "连锡",
    pinyin: "liánxī",
    meaning_vi: "lỗi dính thiếc giữa các chân",
    example_cn: "AOI发现两个引脚之间存在连锡。",
    example_pinyin:
      "AOI fāxiàn liǎng gè yǐnjiǎo zhījiān cúnzài liánxī.",
    example_vi: "AOI phát hiện lỗi dính thiếc giữa hai chân linh kiện.",
  },
  焊接冷焊: {
    chinese: "焊点润湿不良",
    pinyin: "hàndiǎn rùnshī bùliáng",
    meaning_vi: "điểm hàn thấm ướt kém",
    example_cn: "焊点润湿不良会导致连接不稳定。",
    example_pinyin:
      "Hàndiǎn rùnshī bùliáng huì dǎozhì liánjiē bù wěndìng.",
    example_vi: "Điểm hàn thấm ướt kém sẽ làm kết nối không ổn định.",
  },
  锡球偏移: {
    chinese: "焊球偏移",
    pinyin: "hànqiú piānyí",
    meaning_vi: "bi hàn bị lệch",
    example_cn: "BGA焊球偏移可能造成开路或短路。",
    example_pinyin:
      "BGA hànqiú piānyí kěnéng zàochéng kāilù huò duǎnlù.",
    example_vi: "Bi hàn BGA bị lệch có thể gây hở mạch hoặc chập mạch.",
  },
  元件偏动: {
    chinese: "立碑缺陷",
    pinyin: "lìbēi quēxiàn",
    meaning_vi: "lỗi dựng đứng linh kiện",
    example_cn: "回流焊受热不均可能产生立碑缺陷。",
    example_pinyin:
      "Huíliúhàn shòurè bù jūn kěnéng chǎnshēng lìbēi quēxiàn.",
    example_vi:
      "Gia nhiệt không đều khi hàn reflow có thể gây lỗi dựng đứng linh kiện.",
  },
  静电释放保护: {
    chinese: "静电敏感器件",
    pinyin: "jìngdiàn mǐngǎn qìjiàn",
    meaning_vi: "linh kiện nhạy cảm với tĩnh điện",
    example_cn: "操作静电敏感器件时必须佩戴防静电手环。",
    example_pinyin:
      "Cāozuò jìngdiàn mǐngǎn qìjiàn shí bìxū pèidài fáng jìngdiàn shǒuhuán.",
    example_vi:
      "Khi thao tác với linh kiện nhạy cảm tĩnh điện phải đeo vòng tay chống tĩnh điện.",
  },
  防湿柜: {
    chinese: "防潮柜",
    pinyin: "fángcháo guì",
    meaning_vi: "tủ chống ẩm",
    example_cn: "湿敏元件开封后应存放在防潮柜内。",
    example_pinyin:
      "Shīmǐn yuánjiàn kāifēng hòu yīng cúnfàng zài fángcháo guì nèi.",
    example_vi:
      "Linh kiện nhạy ẩm sau khi mở bao bì phải được bảo quản trong tủ chống ẩm.",
  },
  制造环境清洁: {
    chinese: "洁净生产环境",
    pinyin: "jiéjìng shēngchǎn huánjìng",
    meaning_vi: "môi trường sản xuất sạch",
    example_cn: "洁净生产环境可以减少灰尘对电路板的污染。",
    example_pinyin:
      "Jiéjìng shēngchǎn huánjìng kěyǐ jiǎnshǎo huīchén duì diànlùbǎn de wūrǎn.",
    example_vi:
      "Môi trường sản xuất sạch giúp giảm bụi bẩn làm nhiễm bẩn bo mạch.",
  },
  静电释放工作台: {
    chinese: "防静电工作台",
    pinyin: "fáng jìngdiàn gōngzuòtái",
    meaning_vi: "bàn làm việc chống tĩnh điện",
    example_cn: "维修电子产品必须使用防静电工作台。",
    example_pinyin:
      "Wéixiū diànzǐ chǎnpǐn bìxū shǐyòng fáng jìngdiàn gōngzuòtái.",
    example_vi:
      "Việc sửa chữa sản phẩm điện tử phải thực hiện trên bàn làm việc chống tĩnh điện.",
  },
  静电放电测试卡: {
    chinese: "表面电阻测试仪",
    pinyin: "biǎomiàn diànzǔ cèshìyí",
    meaning_vi: "máy đo điện trở bề mặt",
    example_cn: "使用表面电阻测试仪检查防静电材料。",
    example_pinyin:
      "Shǐyòng biǎomiàn diànzǔ cèshìyí jiǎnchá fáng jìngdiàn cáiliào.",
    example_vi:
      "Dùng máy đo điện trở bề mặt để kiểm tra vật liệu chống tĩnh điện.",
  },
};
const dataCorrections = isElectronicsTemplate
  ? electronicsDataCorrections
  : isCommercialTemplate
    ? commercialDataCorrections
    : isLogisticsTemplate
    ? logisticsDataCorrections
    : isConstructionTemplate
      ? constructionDataCorrections
      : factoryDataCorrections;

const fallbackCards: Record<string, GeneratedCard[]> = {
  "esd-packaging-storage": [
    {
      category: "esd-packaging-storage",
      chinese: "真空密封包装",
      pinyin: "zhēnkōng mìfēng bāozhuāng",
      meaning_vi: "đóng gói kín chân không",
      example_cn: "对湿度敏感的元件需要采用真空密封包装。",
      example_pinyin:
        "Duì shīdù mǐngǎn de yuánjiàn xūyào cǎiyòng zhēnkōng mìfēng bāozhuāng.",
      example_vi:
        "Linh kiện nhạy với độ ẩm cần được đóng gói kín chân không.",
    },
  ],
  "ecommerce-wechat": [
    {
      category: "ecommerce-wechat",
      chinese: "小程序商城",
      pinyin: "xiǎochéngxù shāngchéng",
      meaning_vi: "cửa hàng trên ứng dụng mini",
      example_cn: "客户可以直接在小程序商城查看商品并下单。",
      example_pinyin:
        "Kèhù kěyǐ zhíjiē zài xiǎochéngxù shāngchéng chákàn shāngpǐn bìng xiàdān.",
      example_vi:
        "Khách hàng có thể xem sản phẩm và đặt hàng trực tiếp trên cửa hàng ứng dụng mini.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "自动回复",
      pinyin: "zìdòng huífù",
      meaning_vi: "trả lời tự động",
      example_cn: "客服设置了自动回复以便及时接待新客户。",
      example_pinyin:
        "Kèfú shèzhì le zìdòng huífù yǐbiàn jíshí jiēdài xīn kèhù.",
      example_vi:
        "Bộ phận chăm sóc khách hàng đã cài trả lời tự động để tiếp nhận khách mới kịp thời.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "购物车放弃率",
      pinyin: "gòuwùchē fàngqìlǜ",
      meaning_vi: "tỷ lệ bỏ giỏ hàng",
      example_cn: "运营团队正在分析购物车放弃率上升的原因。",
      example_pinyin:
        "Yùnyíng tuánduì zhèngzài fēnxī gòuwùchē fàngqìlǜ shàngshēng de yuányīn.",
      example_vi:
        "Đội vận hành đang phân tích nguyên nhân tỷ lệ bỏ giỏ hàng tăng lên.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "直播间互动",
      pinyin: "zhíbōjiān hùdòng",
      meaning_vi: "tương tác trong phòng livestream",
      example_cn: "主播通过提问增加直播间互动和观众停留时间。",
      example_pinyin:
        "Zhǔbō tōngguò tíwèn zēngjiā zhíbōjiān hùdòng hé guānzhòng tíngliú shíjiān.",
      example_vi:
        "Người livestream đặt câu hỏi để tăng tương tác trong phòng phát và thời gian người xem ở lại.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "粉丝社群",
      pinyin: "fěnsī shèqún",
      meaning_vi: "cộng đồng người theo dõi",
      example_cn: "品牌每天在粉丝社群分享新品和使用建议。",
      example_pinyin:
        "Pǐnpái měitiān zài fěnsī shèqún fēnxiǎng xīnpǐn hé shǐyòng jiànyì.",
      example_vi:
        "Thương hiệu chia sẻ sản phẩm mới và gợi ý sử dụng hằng ngày trong cộng đồng người theo dõi.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "商品上架",
      pinyin: "shāngpǐn shàngjià",
      meaning_vi: "đăng bán sản phẩm",
      example_cn: "商品上架前需要检查图片价格和库存信息。",
      example_pinyin:
        "Shāngpǐn shàngjià qián xūyào jiǎnchá túpiàn jiàgé hé kùcún xìnxī.",
      example_vi:
        "Trước khi đăng bán sản phẩm cần kiểm tra hình ảnh, giá và thông tin tồn kho.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "下单链接",
      pinyin: "xiàdān liànjiē",
      meaning_vi: "đường dẫn đặt hàng",
      example_cn: "客服把正确的下单链接发送到客户微信群。",
      example_pinyin:
        "Kèfú bǎ zhèngquè de xiàdān liànjiē fāsòng dào kèhù Wēixìn qún.",
      example_vi:
        "Bộ phận chăm sóc khách hàng gửi đường dẫn đặt hàng chính xác vào nhóm WeChat của khách.",
    },
    {
      category: "ecommerce-wechat",
      chinese: "售前咨询",
      pinyin: "shòuqián zīxún",
      meaning_vi: "tư vấn trước bán hàng",
      example_cn: "专业的售前咨询可以提高客户的购买意愿。",
      example_pinyin:
        "Zhuānyè de shòuqián zīxún kěyǐ tígāo kèhù de gòumǎi yìyuàn.",
      example_vi:
        "Tư vấn trước bán hàng chuyên nghiệp có thể tăng ý định mua của khách hàng.",
    },
  ],
  "invoices-reconciliation": [
    {
      category: "invoices-reconciliation",
      chinese: "开票信息",
      pinyin: "kāipiào xìnxī",
      meaning_vi: "thông tin xuất hóa đơn",
      example_cn: "客户需要在付款前提供完整的开票信息。",
      example_pinyin:
        "Kèhù xūyào zài fùkuǎn qián tígōng wánzhěng de kāipiào xìnxī.",
      example_vi:
        "Khách hàng cần cung cấp đầy đủ thông tin xuất hóa đơn trước khi thanh toán.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "税务登记号",
      pinyin: "shuìwù dēngjì hào",
      meaning_vi: "mã số đăng ký thuế",
      example_cn: "财务发现发票上的税务登记号填写有误。",
      example_pinyin:
        "Cáiwù fāxiàn fāpiào shàng de shuìwù dēngjì hào tiánxiě yǒuwù.",
      example_vi:
        "Bộ phận tài chính phát hiện mã số đăng ký thuế trên hóa đơn được điền sai.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "发票抬头",
      pinyin: "fāpiào táitóu",
      meaning_vi: "tên đơn vị trên hóa đơn",
      example_cn: "开具电子发票前请再次确认发票抬头。",
      example_pinyin:
        "Kāijù diànzǐ fāpiào qián qǐng zàicì quèrèn fāpiào táitóu.",
      example_vi:
        "Trước khi xuất hóa đơn điện tử, vui lòng xác nhận lại tên đơn vị trên hóa đơn.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "开票申请",
      pinyin: "kāipiào shēnqǐng",
      meaning_vi: "đề nghị xuất hóa đơn",
      example_cn: "销售人员已经把客户的开票申请提交给财务。",
      example_pinyin:
        "Xiāoshòu rényuán yǐjīng bǎ kèhù de kāipiào shēnqǐng tíjiāo gěi cáiwù.",
      example_vi:
        "Nhân viên bán hàng đã gửi đề nghị xuất hóa đơn của khách cho bộ phận tài chính.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "红字发票",
      pinyin: "hóngzì fāpiào",
      meaning_vi: "hóa đơn điều chỉnh giảm",
      example_cn: "原发票金额有误，需要按流程开具红字发票。",
      example_pinyin:
        "Yuán fāpiào jīn'é yǒuwù, xūyào àn liúchéng kāijù hóngzì fāpiào.",
      example_vi:
        "Số tiền trên hóa đơn ban đầu bị sai nên cần xuất hóa đơn điều chỉnh giảm theo quy trình.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "贷项通知单",
      pinyin: "dàixiàng tōngzhīdān",
      meaning_vi: "giấy báo có điều chỉnh",
      example_cn: "双方确认退货金额后由财务出具贷项通知单。",
      example_pinyin:
        "Shuāngfāng quèrèn tuìhuò jīn'é hòu yóu cáiwù chūjù dàixiàng tōngzhīdān.",
      example_vi:
        "Sau khi hai bên xác nhận số tiền hàng trả lại, bộ phận tài chính sẽ phát hành giấy báo có điều chỉnh.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "应收账龄",
      pinyin: "yīngshōu zhànglíng",
      meaning_vi: "tuổi nợ phải thu",
      example_cn: "财务每月检查应收账龄并跟进长期未付款项。",
      example_pinyin:
        "Cáiwù měiyuè jiǎnchá yīngshōu zhànglíng bìng gēnjìn chángqī wèi fù kuǎnxiàng.",
      example_vi:
        "Hằng tháng bộ phận tài chính kiểm tra tuổi nợ phải thu và theo dõi các khoản chưa thanh toán lâu ngày.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "账龄分析",
      pinyin: "zhànglíng fēnxī",
      meaning_vi: "phân tích tuổi nợ",
      example_cn: "账龄分析可以帮助销售团队识别高风险客户。",
      example_pinyin:
        "Zhànglíng fēnxī kěyǐ bāngzhù xiāoshòu tuánduì shíbié gāo fēngxiǎn kèhù.",
      example_vi:
        "Phân tích tuổi nợ giúp đội ngũ bán hàng nhận diện khách hàng có rủi ro cao.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "坏账准备",
      pinyin: "huàizhàng zhǔnbèi",
      meaning_vi: "dự phòng nợ xấu",
      example_cn: "公司根据客户回款情况调整坏账准备。",
      example_pinyin:
        "Gōngsī gēnjù kèhù huíkuǎn qíngkuàng tiáozhěng huàizhàng zhǔnbèi.",
      example_vi:
        "Công ty điều chỉnh dự phòng nợ xấu dựa trên tình hình thu hồi công nợ của khách hàng.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "回款记录",
      pinyin: "huíkuǎn jìlù",
      meaning_vi: "lịch sử thu tiền",
      example_cn: "业务员需要及时更新客户的回款记录。",
      example_pinyin:
        "Yèwùyuán xūyào jíshí gēngxīn kèhù de huíkuǎn jìlù.",
      example_vi:
        "Nhân viên kinh doanh cần cập nhật kịp thời lịch sử thu tiền của khách hàng.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "收款确认",
      pinyin: "shōukuǎn quèrèn",
      meaning_vi: "xác nhận đã thu tiền",
      example_cn: "收到银行通知后财务会完成收款确认。",
      example_pinyin:
        "Shōudào yínháng tōngzhī hòu cáiwù huì wánchéng shōukuǎn quèrèn.",
      example_vi:
        "Sau khi nhận thông báo từ ngân hàng, bộ phận tài chính sẽ xác nhận đã thu tiền.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "未开票金额",
      pinyin: "wèi kāipiào jīn'é",
      meaning_vi: "số tiền chưa xuất hóa đơn",
      example_cn: "月末财务需要统计所有未开票金额。",
      example_pinyin:
        "Yuèmò cáiwù xūyào tǒngjì suǒyǒu wèi kāipiào jīn'é.",
      example_vi:
        "Cuối tháng, bộ phận tài chính cần thống kê toàn bộ số tiền chưa xuất hóa đơn.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "进项发票",
      pinyin: "jìnxiàng fāpiào",
      meaning_vi: "hóa đơn đầu vào",
      example_cn: "会计正在整理供应商本月提供的进项发票。",
      example_pinyin:
        "Kuàijì zhèngzài zhěnglǐ gōngyìngshāng běnyuè tígōng de jìnxiàng fāpiào.",
      example_vi:
        "Kế toán đang sắp xếp các hóa đơn đầu vào do nhà cung cấp gửi trong tháng này.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "销项发票",
      pinyin: "xiāoxiàng fāpiào",
      meaning_vi: "hóa đơn đầu ra",
      example_cn: "财务需要核对销项发票和销售记录是否一致。",
      example_pinyin:
        "Cáiwù xūyào héduì xiāoxiàng fāpiào hé xiāoshòu jìlù shìfǒu yízhì.",
      example_vi:
        "Bộ phận tài chính cần đối chiếu hóa đơn đầu ra với lịch sử bán hàng.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "发票号码",
      pinyin: "fāpiào hàomǎ",
      meaning_vi: "số hóa đơn",
      example_cn: "客户在付款说明中填写了对应的发票号码。",
      example_pinyin:
        "Kèhù zài fùkuǎn shuōmíng zhōng tiánxiě le duìyìng de fāpiào hàomǎ.",
      example_vi:
        "Khách hàng đã điền số hóa đơn tương ứng trong nội dung thanh toán.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "开票日期",
      pinyin: "kāipiào rìqī",
      meaning_vi: "ngày xuất hóa đơn",
      example_cn: "请确认系统记录的开票日期是否正确。",
      example_pinyin:
        "Qǐng quèrèn xìtǒng jìlù de kāipiào rìqī shìfǒu zhèngquè.",
      example_vi:
        "Vui lòng xác nhận ngày xuất hóa đơn được ghi trên hệ thống có chính xác hay không.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "催款函",
      pinyin: "cuīkuǎn hán",
      meaning_vi: "thư nhắc thanh toán",
      example_cn: "账款逾期后财务向客户发送了正式催款函。",
      example_pinyin:
        "Zhàngkuǎn yúqī hòu cáiwù xiàng kèhù fāsòng le zhèngshì cuīkuǎn hán.",
      example_vi:
        "Sau khi khoản nợ quá hạn, bộ phận tài chính đã gửi thư nhắc thanh toán chính thức cho khách hàng.",
    },
    {
      category: "invoices-reconciliation",
      chinese: "税额核对",
      pinyin: "shuì'é héduì",
      meaning_vi: "đối chiếu tiền thuế",
      example_cn: "开票前会计必须完成税额核对避免出现差错。",
      example_pinyin:
        "Kāipiào qián kuàijì bìxū wánchéng shuì'é héduì bìmiǎn chūxiàn chācuò.",
      example_vi:
        "Trước khi xuất hóa đơn, kế toán phải hoàn tất đối chiếu tiền thuế để tránh sai sót.",
    },
  ],
  "orders-payment": [
    {
      category: "orders-payment",
      chinese: "付款凭证",
      pinyin: "fùkuǎn píngzhèng",
      meaning_vi: "chứng từ thanh toán",
      example_cn: "完成转账后请把付款凭证发送给财务人员。",
      example_pinyin:
        "Wánchéng zhuǎnzhàng hòu qǐng bǎ fùkuǎn píngzhèng fāsòng gěi cáiwù rényuán.",
      example_vi:
        "Sau khi chuyển khoản, vui lòng gửi chứng từ thanh toán cho nhân viên tài chính.",
    },
    {
      category: "orders-payment",
      chinese: "到账通知",
      pinyin: "dàozhàng tōngzhī",
      meaning_vi: "thông báo tiền đã vào tài khoản",
      example_cn: "财务收到到账通知后会立即安排订单处理。",
      example_pinyin:
        "Cáiwù shōudào dàozhàng tōngzhī hòu huì lìjí ānpái dìngdān chǔlǐ.",
      example_vi:
        "Sau khi nhận thông báo tiền đã vào tài khoản, bộ phận tài chính sẽ lập tức xử lý đơn hàng.",
    },
    {
      category: "orders-payment",
      chinese: "支付授权",
      pinyin: "zhīfù shòuquán",
      meaning_vi: "ủy quyền thanh toán",
      example_cn: "这笔采购款需要负责人完成支付授权。",
      example_pinyin:
        "Zhè bǐ cǎigòu kuǎn xūyào fùzérén wánchéng zhīfù shòuquán.",
      example_vi:
        "Khoản tiền mua hàng này cần người phụ trách hoàn tất ủy quyền thanh toán.",
    },
    {
      category: "orders-payment",
      chinese: "扣款确认",
      pinyin: "kòukuǎn quèrèn",
      meaning_vi: "xác nhận trừ tiền",
      example_cn: "客户完成扣款确认后系统才会更新支付状态。",
      example_pinyin:
        "Kèhù wánchéng kòukuǎn quèrèn hòu xìtǒng cái huì gēngxīn zhīfù zhuàngtài.",
      example_vi:
        "Sau khi khách hàng xác nhận trừ tiền, hệ thống mới cập nhật trạng thái thanh toán.",
    },
    {
      category: "orders-payment",
      chinese: "订单备注",
      pinyin: "dìngdān bèizhù",
      meaning_vi: "ghi chú đơn hàng",
      example_cn: "特殊包装要求已经写在订单备注里面。",
      example_pinyin:
        "Tèshū bāozhuāng yāoqiú yǐjīng xiě zài dìngdān bèizhù lǐmiàn.",
      example_vi:
        "Yêu cầu đóng gói đặc biệt đã được ghi trong phần ghi chú đơn hàng.",
    },
    {
      category: "orders-payment",
      chinese: "取消申请",
      pinyin: "qǔxiāo shēnqǐng",
      meaning_vi: "đề nghị hủy",
      example_cn: "订单进入处理阶段后需要提交正式取消申请。",
      example_pinyin:
        "Dìngdān jìnrù chǔlǐ jiēduàn hòu xūyào tíjiāo zhèngshì qǔxiāo shēnqǐng.",
      example_vi:
        "Sau khi đơn hàng bước vào giai đoạn xử lý, cần gửi đề nghị hủy chính thức.",
    },
    {
      category: "orders-payment",
      chinese: "交易流水",
      pinyin: "jiāoyì liúshuǐ",
      meaning_vi: "lịch sử giao dịch",
      example_cn: "财务正在核对银行提供的交易流水。",
      example_pinyin:
        "Cáiwù zhèngzài héduì yínháng tígōng de jiāoyì liúshuǐ.",
      example_vi:
        "Bộ phận tài chính đang đối chiếu lịch sử giao dịch do ngân hàng cung cấp.",
    },
    {
      category: "orders-payment",
      chinese: "支付状态",
      pinyin: "zhīfù zhuàngtài",
      meaning_vi: "trạng thái thanh toán",
      example_cn: "销售人员会在系统中及时更新支付状态。",
      example_pinyin:
        "Xiāoshòu rényuán huì zài xìtǒng zhōng jíshí gēngxīn zhīfù zhuàngtài.",
      example_vi:
        "Nhân viên bán hàng sẽ cập nhật trạng thái thanh toán kịp thời trên hệ thống.",
    },
  ],
  "contracts-terms": [
    {
      category: "contracts-terms",
      chinese: "合同标的",
      pinyin: "hétóng biāodì",
      meaning_vi: "đối tượng của hợp đồng",
      example_cn: "双方应在合同中明确合同标的和质量要求。",
      example_pinyin:
        "Shuāngfāng yīng zài hétóng zhōng míngquè hétóng biāodì hé zhìliàng yāoqiú.",
      example_vi:
        "Hai bên cần nêu rõ đối tượng của hợp đồng và yêu cầu chất lượng trong hợp đồng.",
    },
    {
      category: "contracts-terms",
      chinese: "适用法律",
      pinyin: "shìyòng fǎlǜ",
      meaning_vi: "pháp luật áp dụng",
      example_cn: "签约前双方需要确认合同约定的适用法律。",
      example_pinyin:
        "Qiānyuē qián shuāngfāng xūyào quèrèn hétóng yuēdìng de shìyòng fǎlǜ.",
      example_vi:
        "Trước khi ký kết, hai bên cần xác nhận pháp luật áp dụng được quy định trong hợp đồng.",
    },
    {
      category: "contracts-terms",
      chinese: "争议解决",
      pinyin: "zhēngyì jiějué",
      meaning_vi: "giải quyết tranh chấp",
      example_cn: "合同中的争议解决方式需要得到双方认可。",
      example_pinyin:
        "Hétóng zhōng de zhēngyì jiějué fāngshì xūyào dédào shuāngfāng rènkě.",
      example_vi:
        "Phương thức giải quyết tranh chấp trong hợp đồng cần được cả hai bên chấp thuận.",
    },
    {
      category: "contracts-terms",
      chinese: "不可抗力",
      pinyin: "bùkěkànglì",
      meaning_vi: "sự kiện bất khả kháng",
      example_cn: "发生不可抗力后受影响的一方应及时通知对方。",
      example_pinyin:
        "Fāshēng bùkěkànglì hòu shòu yǐngxiǎng de yìfāng yīng jíshí tōngzhī duìfāng.",
      example_vi:
        "Sau khi xảy ra sự kiện bất khả kháng, bên bị ảnh hưởng cần thông báo kịp thời cho bên kia.",
    },
    {
      category: "contracts-terms",
      chinese: "通知条款",
      pinyin: "tōngzhī tiáokuǎn",
      meaning_vi: "điều khoản thông báo",
      example_cn: "通知条款规定了双方发送正式文件的方式。",
      example_pinyin:
        "Tōngzhī tiáokuǎn guīdìng le shuāngfāng fāsòng zhèngshì wénjiàn de fāngshì.",
      example_vi:
        "Điều khoản thông báo quy định cách hai bên gửi các văn bản chính thức.",
    },
    {
      category: "contracts-terms",
      chinese: "授权代表",
      pinyin: "shòuquán dàibiǎo",
      meaning_vi: "đại diện được ủy quyền",
      example_cn: "合同必须由双方授权代表签字后才能生效。",
      example_pinyin:
        "Hétóng bìxū yóu shuāngfāng shòuquán dàibiǎo qiānzì hòu cáinéng shēngxiào.",
      example_vi:
        "Hợp đồng chỉ có hiệu lực sau khi đại diện được ủy quyền của hai bên ký tên.",
    },
    {
      category: "contracts-terms",
      chinese: "履约保证",
      pinyin: "lǚyuē bǎozhèng",
      meaning_vi: "bảo đảm thực hiện hợp đồng",
      example_cn: "买方要求卖方按约定提供履约保证。",
      example_pinyin:
        "Mǎifāng yāoqiú màifāng àn yuēdìng tígōng lǚyuē bǎozhèng.",
      example_vi:
        "Bên mua yêu cầu bên bán cung cấp bảo đảm thực hiện hợp đồng theo thỏa thuận.",
    },
    {
      category: "contracts-terms",
      chinese: "续约条款",
      pinyin: "xùyuē tiáokuǎn",
      meaning_vi: "điều khoản gia hạn hợp đồng",
      example_cn: "双方决定在续约前重新讨论续约条款。",
      example_pinyin:
        "Shuāngfāng juédìng zài xùyuē qián chóngxīn tǎolùn xùyuē tiáokuǎn.",
      example_vi:
        "Hai bên quyết định thảo luận lại điều khoản gia hạn trước khi tiếp tục hợp đồng.",
    },
    {
      category: "contracts-terms",
      chinese: "解除条件",
      pinyin: "jiěchú tiáojiàn",
      meaning_vi: "điều kiện chấm dứt hợp đồng",
      example_cn: "法务人员建议进一步明确合同的解除条件。",
      example_pinyin:
        "Fǎwù rényuán jiànyì jìnyíbù míngquè hétóng de jiěchú tiáojiàn.",
      example_vi:
        "Nhân viên pháp chế đề nghị làm rõ hơn điều kiện chấm dứt hợp đồng.",
    },
    {
      category: "contracts-terms",
      chinese: "违约金",
      pinyin: "wéiyuējīn",
      meaning_vi: "tiền phạt vi phạm hợp đồng",
      example_cn: "双方需要合理约定延迟履行产生的违约金。",
      example_pinyin:
        "Shuāngfāng xūyào hélǐ yuēdìng yánchí lǚxíng chǎnshēng de wéiyuējīn.",
      example_vi:
        "Hai bên cần thỏa thuận hợp lý khoản phạt phát sinh khi thực hiện hợp đồng chậm.",
    },
    {
      category: "contracts-terms",
      chinese: "管辖法院",
      pinyin: "guǎnxiá fǎyuàn",
      meaning_vi: "tòa án có thẩm quyền",
      example_cn: "法务部门正在核对合同约定的管辖法院。",
      example_pinyin:
        "Fǎwù bùmén zhèngzài héduì hétóng yuēdìng de guǎnxiá fǎyuàn.",
      example_vi:
        "Bộ phận pháp chế đang kiểm tra tòa án có thẩm quyền được quy định trong hợp đồng.",
    },
    {
      category: "contracts-terms",
      chinese: "合同正本",
      pinyin: "hétóng zhèngběn",
      meaning_vi: "bản chính hợp đồng",
      example_cn: "签字盖章后双方各自保留一份合同正本。",
      example_pinyin:
        "Qiānzì gàizhāng hòu shuāngfāng gèzì bǎoliú yífèn hétóng zhèngběn.",
      example_vi:
        "Sau khi ký tên và đóng dấu, mỗi bên giữ một bản chính hợp đồng.",
    },
  ],
  "safety-progress-acceptance": [
    {
      category: "safety-progress-acceptance",
      chinese: "高处作业许可证",
      pinyin: "gāochù zuòyè xǔkězhèng",
      meaning_vi: "giấy phép làm việc trên cao",
      example_cn: "施工人员进入作业区前必须确认高处作业许可证有效。",
      example_pinyin:
        "Shīgōng rényuán jìnrù zuòyèqū qián bìxū quèrèn gāochù zuòyè xǔkězhèng yǒuxiào.",
      example_vi:
        "Trước khi vào khu vực làm việc, nhân viên thi công phải xác nhận giấy phép làm việc trên cao còn hiệu lực.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "临边防护",
      pinyin: "línbiān fánghù",
      meaning_vi: "biện pháp bảo vệ mép sàn",
      example_cn: "楼层施工前要检查所有临边防护是否牢固。",
      example_pinyin:
        "Lóucéng shīgōng qián yào jiǎnchá suǒyǒu línbiān fánghù shìfǒu láogù.",
      example_vi:
        "Trước khi thi công tầng, cần kiểm tra mọi biện pháp bảo vệ mép sàn có chắc chắn hay không.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "安全技术交底",
      pinyin: "ānquán jìshù jiāodǐ",
      meaning_vi: "phổ biến kỹ thuật an toàn",
      example_cn: "新工序开始前，班组必须完成安全技术交底。",
      example_pinyin:
        "Xīn gōngxù kāishǐ qián, bānzǔ bìxū wánchéng ānquán jìshù jiāodǐ.",
      example_vi:
        "Trước khi bắt đầu công đoạn mới, tổ đội phải hoàn thành việc phổ biến kỹ thuật an toàn.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "班前安全会",
      pinyin: "bānqián ānquán huì",
      meaning_vi: "họp an toàn đầu ca",
      example_cn: "班前安全会重点说明今天的施工风险和防护要求。",
      example_pinyin:
        "Bānqián ānquán huì zhòngdiǎn shuōmíng jīntiān de shīgōng fēngxiǎn hé fánghù yāoqiú.",
      example_vi:
        "Cuộc họp an toàn đầu ca tập trung giải thích rủi ro thi công và yêu cầu bảo hộ trong ngày.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "危险源辨识",
      pinyin: "wēixiǎnyuán biànshí",
      meaning_vi: "nhận diện nguồn nguy hiểm",
      example_cn: "项目部每周组织危险源辨识并更新控制措施。",
      example_pinyin:
        "Xiàngmùbù měi zhōu zǔzhī wēixiǎnyuán biànshí bìng gēngxīn kòngzhì cuòshī.",
      example_vi:
        "Ban dự án tổ chức nhận diện nguồn nguy hiểm hằng tuần và cập nhật biện pháp kiểm soát.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "进度偏差",
      pinyin: "jìndù piānchā",
      meaning_vi: "sai lệch tiến độ",
      example_cn: "现场负责人正在分析进度偏差并调整施工安排。",
      example_pinyin:
        "Xiànchǎng fùzérén zhèngzài fēnxī jìndù piānchā bìng tiáozhěng shīgōng ānpái.",
      example_vi:
        "Người phụ trách hiện trường đang phân tích sai lệch tiến độ và điều chỉnh kế hoạch thi công.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "赶工措施",
      pinyin: "gǎngōng cuòshī",
      meaning_vi: "biện pháp đẩy nhanh tiến độ",
      example_cn: "采用赶工措施时仍要保证施工质量和人员安全。",
      example_pinyin:
        "Cǎiyòng gǎngōng cuòshī shí réng yào bǎozhèng shīgōng zhìliàng hé rényuán ānquán.",
      example_vi:
        "Khi áp dụng biện pháp đẩy nhanh tiến độ vẫn phải bảo đảm chất lượng thi công và an toàn nhân sự.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "隐蔽工程验收",
      pinyin: "yǐnbì gōngchéng yànshōu",
      meaning_vi: "nghiệm thu công việc bị che khuất",
      example_cn: "封闭吊顶之前必须完成隐蔽工程验收。",
      example_pinyin:
        "Fēngbì diàodǐng zhīqián bìxū wánchéng yǐnbì gōngchéng yànshōu.",
      example_vi:
        "Trước khi đóng trần phải hoàn thành nghiệm thu công việc bị che khuất.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "整改通知单",
      pinyin: "zhěnggǎi tōngzhīdān",
      meaning_vi: "biên bản yêu cầu khắc phục",
      example_cn: "监理发现质量问题后向施工单位发出整改通知单。",
      example_pinyin:
        "Jiānlǐ fāxiàn zhìliàng wèntí hòu xiàng shīgōng dānwèi fāchū zhěnggǎi tōngzhīdān.",
      example_vi:
        "Sau khi phát hiện vấn đề chất lượng, tư vấn giám sát gửi biên bản yêu cầu khắc phục cho đơn vị thi công.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "竣工验收",
      pinyin: "jùngōng yànshōu",
      meaning_vi: "nghiệm thu hoàn thành công trình",
      example_cn: "竣工验收前要整理完整的施工记录和检测报告。",
      example_pinyin:
        "Jùngōng yànshōu qián yào zhěnglǐ wánzhěng de shīgōng jìlù hé jiǎncè bàogào.",
      example_vi:
        "Trước khi nghiệm thu hoàn thành công trình cần sắp xếp đầy đủ hồ sơ thi công và báo cáo kiểm tra.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "安全巡查",
      pinyin: "ānquán xúnchá",
      meaning_vi: "kiểm tra an toàn định kỳ",
      example_cn: "安全员每天进行安全巡查并记录现场隐患。",
      example_pinyin:
        "Ānquányuán měitiān jìnxíng ānquán xúnchá bìng jìlù xiànchǎng yǐnhuàn.",
      example_vi:
        "Nhân viên an toàn thực hiện kiểm tra an toàn hằng ngày và ghi nhận nguy cơ tại hiện trường.",
    },
    {
      category: "safety-progress-acceptance",
      chinese: "应急疏散",
      pinyin: "yìngjí shūsàn",
      meaning_vi: "sơ tán khẩn cấp",
      example_cn: "项目部定期组织应急疏散演练，确保通道畅通。",
      example_pinyin:
        "Xiàngmùbù dìngqī zǔzhī yìngjí shūsàn yǎnliàn, quèbǎo tōngdào chàngtōng.",
      example_vi:
        "Ban dự án định kỳ tổ chức diễn tập sơ tán khẩn cấp để bảo đảm lối đi thông thoáng.",
    },
  ],
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
            name: isElectronicsTemplate
              ? "electronics_components_quality_cards"
              : isCommercialTemplate
                ? "commercial_contract_vocabulary_cards"
                : isLogisticsTemplate
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
            content: isElectronicsTemplate
              ? "Bạn là giáo viên tiếng Trung chuyên ngành điện tử cho người Việt làm sản xuất, kỹ thuật và kiểm tra chất lượng. Hãy tạo đúng số lượng từ vựng tiếng Trung giản thể thực tế, chuẩn kỹ thuật và dùng được trong nhà máy điện tử. Mỗi mục phải là một từ hoặc cụm từ chuyên môn hữu ích, không phải cả câu; tránh từ quá cơ bản, tránh từ trùng nghĩa giữa các nhóm và ưu tiên thuật ngữ người vận hành, kỹ thuật viên, PE, QE, IQC, IPQC và OQC thực sự dùng. Pinyin của từ và câu phải có dấu thanh đầy đủ, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu và chính xác về điện tử. Câu ví dụ phải dài khoảng 8-26 chữ Hán, chứa nguyên văn liên tục từ mục tiêu và mô tả một tình huống cụ thể về PCB, linh kiện, nguồn điện, cảm biến, SMT, hàn, lắp ráp, đo kiểm, chất lượng, phân tích lỗi, ESD, đóng gói hoặc bảo quản. Không tự đặt tên công ty, mã linh kiện, mã sản phẩm, giá trị điện cụ thể hay thông số nguy hiểm. Không đưa hướng dẫn sửa điện trái quy trình an toàn, không khẳng định kỹ thuật tuyệt đối và không dùng câu chung chung lặp khuôn. Giữ category đúng id được yêu cầu."
              : isCommercialTemplate
                ? "Bạn là giáo viên tiếng Trung thương mại chuyên đào tạo người Việt làm kinh doanh, bán hàng và quản lý hợp đồng với đối tác Trung Quốc. Hãy tạo đúng số lượng từ vựng tiếng Trung giản thể thực tế, chuẩn nghiệp vụ và dùng được trong công việc. Mỗi mục phải là một từ hoặc cụm từ thương mại hữu ích, không phải cả câu; tránh từ quá cơ bản, tránh trùng khái niệm giữa các nhóm và không lặp lại trọng tâm xuất nhập khẩu, hải quan, Incoterms hay vận tải của bộ logistics. Pinyin của từ và câu phải có dấu thanh đầy đủ, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu và chính xác về thương mại. Câu ví dụ phải dài khoảng 8-26 chữ Hán, chứa nguyên văn liên tục từ mục tiêu và mô tả một tình huống cụ thể về khách hàng, sản phẩm, báo giá, thương lượng, chiết khấu, hợp đồng, đơn hàng, thanh toán, hóa đơn, công nợ, đại lý, hậu mãi, khiếu nại hoặc thương mại điện tử. Không tự đặt tên công ty, mã đơn hàng, số tài khoản hay mức giá cụ thể. Không đưa lời khuyên pháp lý hoặc tài chính tuyệt đối và không dùng câu chung chung lặp khuôn. Giữ category đúng id được yêu cầu."
                : isLogisticsTemplate
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
