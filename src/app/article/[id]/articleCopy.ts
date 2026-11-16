import type { Language } from "@/lib/language";
import type { SourceType } from "@/lib/types";

// Every user-facing string on the article page, in both languages.
// Vietnamese is the primary voice; technical terms stay English.

// One date format, day first, with the year, in a fixed zone (Vietnam) so
// the server's text and the browser's agree whatever the reader's timezone.
function formatDate(date: Date, language: Language): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: language === "vi" ? "numeric" : "short",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return language === "vi"
    ? `${get("day")}/${get("month")}/${get("year")}`
    : `${get("day")} ${get("month")} ${get("year")}`;
}

type Copy = {
  skip: string;
  back: string;
  backLabel: string;
  themeToDark: string;
  themeToLight: string;
  save: string;
  saved: string;
  saveLabel: string;
  unsaveLabel: string;
  original: Record<SourceType, string>;
  openRepo: string;
  backToFeed: string;
  summaryOnly: string;
  hnDiscussion: string;
  hnPoints: (n: number) => string;
  stars: (n: number) => string;
  readMinutes: (n: number) => string;
  statMinutes: string;
  statSections: string;
  standfirstMore: string;
  standfirstLess: string;
  tocTitle: string;
  tocToggle: (n: number) => string;
  tocAll: (n: number) => string;
  tocLess: string;
  tocEnglish: string;
  minutesLeft: (n: number) => string;
  video: string;
  date: (d: Date) => string;
  titlePending: string;
  // Body
  opening: string;
  translating: string;
  translatingNote: string;
  translatingLongNote: (parts: number) => string;
  readEnglishNow: string;
  readingEnglishNote: string;
  viReady: string;
  viReadyPartial: string;
  viFailedWhileEnglish: string;
  switchToVi: string;
  loadingBody: string;
  translationFailed: string;
  partialLead: (n: number) => string;
  partialNote: string;
  partialFailed: string;
  continueTranslation: string;
  retryTranslation: string;
  continuing: string;
  noContentTitle: string;
  noContentNote: string;
  releaseEmpty: string;
  readmeMissing: string;
  // End
  sourceLabel: string;
  machineTranslated: string;
  // Not found
  notFoundTitle: string;
  notFoundNote: (days: number | null) => string;
  notFoundAction: string;
  savedExpiredNote: string;
};

const vi: Copy = {
  skip: "Bỏ qua, tới nội dung bài",
  back: "OneForAll",
  backLabel: "Về feed OneForAll",
  themeToDark: "Chuyển sang giao diện tối",
  themeToLight: "Chuyển sang giao diện sáng",
  save: "Lưu",
  saved: "Đã lưu",
  saveLabel: "Lưu để đọc sau",
  unsaveLabel: "Bỏ lưu",
  original: {
    rss: "Đọc bản gốc",
    hn: "Đọc bản gốc",
    "github-trending": "Mở repo",
    "github-release": "Xem trên GitHub",
  },
  openRepo: "Mở repo",
  backToFeed: "Về feed",
  summaryOnly: "Tóm tắt tự động, chưa có nội dung gốc",
  hnDiscussion: "Thảo luận trên HN",
  hnPoints: (n) => `${n.toLocaleString("vi-VN")} điểm HN`,
  stars: (n) => `${n.toLocaleString("vi-VN")} sao`,
  readMinutes: (n) => `đọc ${n} phút`,
  statMinutes: "phút đọc",
  statSections: "mục",
  standfirstMore: "Đọc hết tóm tắt",
  standfirstLess: "Thu gọn",
  tocTitle: "Trong bài này",
  tocToggle: (n) => `Trong bài này · ${n} mục`,
  tocAll: (n) => `Xem cả ${n} mục`,
  tocLess: "Thu gọn",
  tocEnglish: "Tiêu đề còn bằng tiếng Anh",
  minutesLeft: (n) => (n > 0 ? `Còn ${n} phút` : "Sắp hết bài"),
  video: "Video",
  date: (d) => formatDate(d, "vi"),
  titlePending: "Bản tiếng Việt của tiêu đề và tóm tắt chưa xong, đang hiện bản gốc.",
  opening: "Đang mở bài…",
  translating: "Đang dịch bài sang tiếng Việt…",
  translatingNote: "Bài ngắn thường xong trong vài giây. Bản dịch được lưu lại, lần sau mở ngay.",
  translatingLongNote: (parts) =>
    `Bài dài (${parts} phần) được dịch theo đợt, đợt này có thể mất tới nửa phút. Bản dịch được lưu lại, lần sau mở ngay.`,
  readEnglishNow: "Đọc bản tiếng Anh trong lúc chờ",
  readingEnglishNote: "Đang hiện bản tiếng Anh gốc. Bản tiếng Việt vẫn đang được dịch.",
  viReady: "Bản tiếng Việt đã xong.",
  viReadyPartial: "Đã dịch xong phần đầu bài.",
  viFailedWhileEnglish: "Chưa dịch được bài này, bạn đang đọc bản tiếng Anh gốc.",
  switchToVi: "Chuyển sang tiếng Việt",
  loadingBody: "Đang tải nội dung bài…",
  translationFailed: "Chưa dịch được bài này, đang hiện bản tiếng Anh.",
  partialLead: (n) => `Phần dưới chưa được dịch (còn ${n} đoạn), đang hiện bản tiếng Anh.`,
  partialNote: "Bài dài được dịch từng đợt. Bấm Dịch tiếp, hoặc mở lại bài sau, để dịch thêm.",
  partialFailed: "Đợt dịch vừa rồi bị lỗi. Thử lại sau ít phút.",
  continueTranslation: "Dịch tiếp",
  retryTranslation: "Thử dịch lại",
  continuing: "Đang dịch tiếp…",
  noContentTitle: "Không lấy được nội dung bài gốc.",
  noContentNote:
    "Trang gốc chặn trích xuất hoặc không có phần nội dung, nên tóm tắt ở trên có thể chỉ dựa vào tiêu đề. Mở bản gốc để đọc toàn bộ.",
  releaseEmpty: "Bản phát hành này không có ghi chú.",
  readmeMissing: "Không lấy được README của repo này.",
  sourceLabel: "Nguồn",
  machineTranslated: "Bản dịch tự động bằng AI, thuật ngữ giữ nguyên tiếng Anh.",
  notFoundTitle: "Tin này không còn trong feed.",
  notFoundNote: (days) =>
    days ? `Feed chỉ giữ tin trong ${days} ngày gần nhất.` : "Feed chỉ giữ tin trong vài ngày gần nhất.",
  notFoundAction: "Về feed",
  savedExpiredNote: "Tin đã quá hạn giữ của feed, nhưng bạn đã lưu nó trong trình duyệt này.",
};

const en: Copy = {
  skip: "Skip to the article",
  back: "OneForAll",
  backLabel: "Back to the OneForAll feed",
  themeToDark: "Switch to dark theme",
  themeToLight: "Switch to light theme",
  save: "Save",
  saved: "Saved",
  saveLabel: "Save for later",
  unsaveLabel: "Remove from saved",
  original: {
    rss: "Read the original",
    hn: "Read the original",
    "github-trending": "Open the repo",
    "github-release": "View on GitHub",
  },
  openRepo: "Open the repo",
  backToFeed: "Back to the feed",
  summaryOnly: "Automatic summary, original content not available",
  hnDiscussion: "Discussion on HN",
  hnPoints: (n) => `${n.toLocaleString("en-US")} HN points`,
  stars: (n) => `${n.toLocaleString("en-US")} stars`,
  readMinutes: (n) => `${n} min read`,
  statMinutes: "min read",
  statSections: "sections",
  standfirstMore: "Show the full summary",
  standfirstLess: "Show less",
  tocTitle: "In this article",
  tocToggle: (n) => `In this article · ${n} sections`,
  tocAll: (n) => `Show all ${n} sections`,
  tocLess: "Show fewer",
  tocEnglish: "Heading still in English",
  minutesLeft: (n) => (n > 0 ? `${n} min left` : "Almost done"),
  video: "Video",
  date: (d) => formatDate(d, "en"),
  titlePending: "",
  opening: "Opening the article…",
  translating: "",
  translatingNote: "",
  translatingLongNote: () => "",
  readEnglishNow: "",
  readingEnglishNote: "",
  viReady: "",
  viReadyPartial: "",
  viFailedWhileEnglish: "",
  switchToVi: "",
  loadingBody: "Loading the article…",
  translationFailed: "",
  partialLead: () => "",
  partialNote: "",
  partialFailed: "",
  continueTranslation: "",
  retryTranslation: "",
  continuing: "",
  noContentTitle: "Couldn't load the original article.",
  noContentNote:
    "The source blocks extraction or has no article body, so the summary above may rest on the title alone. Open the original to read it in full.",
  releaseEmpty: "This release has no notes.",
  readmeMissing: "Couldn't load this repo's README.",
  sourceLabel: "Source",
  machineTranslated: "",
  notFoundTitle: "This item isn't in the feed anymore.",
  notFoundNote: (days) =>
    days ? `The feed keeps only the last ${days} days.` : "The feed keeps only the last few days.",
  notFoundAction: "Back to the feed",
  savedExpiredNote: "It aged out of the feed, but you saved it in this browser.",
};

export function articleCopy(language: Language): Copy {
  return language === "vi" ? vi : en;
}

export type ArticleCopy = Copy;
