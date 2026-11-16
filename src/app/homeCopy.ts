import type { Language } from "@/lib/language";

// Every user-facing string on the home feed, in both languages. Vietnamese
// is the primary voice; technical terms (agent, MCP, release…) stay English.

export type GroupId = "workflow" | "career" | "tools" | "releases" | "industry";

type Copy = {
  skip: string;
  views: { new: string; all: string; saved: string };
  viewsLabel: string;
  topicsLabel: string;
  sourceLabel: string;
  sourceAll: string;
  sourceTypes: string;
  sourceFeeds: string;
  typeNames: Record<"rss" | "hn" | "github-trending" | "github-release", string>;
  topicAll: string;
  topics: Record<string, string>;
  topicShort: Record<string, string>;
  groups: Record<GroupId, (n: number) => string>;
  dashboard: string;
  settings: string;
  langSwitch: string;
  themeToDark: string;
  themeToLight: string;
  // Catch-up band
  newSince: (n: number, since: string) => string;
  newLead: Partial<Record<GroupId, (n: number) => string>>;
  nothingNew: (since: string) => string;
  firstVisit: (n: number) => string;
  firstVisitNote: string;
  longGapNote: (days: number) => string;
  neverFetched: string;
  neverFetchedNote: string;
  updatedAgo: (ago: string) => string;
  catchUpLabel: string;
  // Rows
  newBadge: string;
  video: string;
  readMinutes: (n: number) => string;
  videoMinutes: (n: number) => string;
  sourcesCount: (n: number) => string;
  save: string;
  unsave: string;
  original: string;
  originalOf: (title: string) => string;
  translationPending: string;
  releasesNew: (n: number) => string;
  releasesAll: (n: number) => string;
  showVersions: (n: number) => string;
  hideVersions: string;
  // Industry
  industry: string;
  industryMore: (n: number) => string;
  industryLess: string;
  // Empty states
  emptyNew: string;
  emptyNewAction: string;
  emptyFilter: string;
  emptyFilterAction: string;
  emptySaved: string;
  emptySavedNote: string;
  emptyStore: string;
  savedNote: string;
  loadingMore: string;
  // Time
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  yesterday: string;
  daysAgo: (n: number) => string;
  sinceToday: (time: string) => string;
  sinceYesterday: (time: string) => string;
  sinceWeekday: (weekday: string) => string;
  sinceDate: (date: string) => string;
  weekdays: string[];
  shortDate: (d: Date) => string;
};

const vi: Copy = {
  skip: "Bỏ qua, tới danh sách tin",
  views: { new: "Mới", all: "Tất cả", saved: "Đã lưu" },
  viewsLabel: "Chế độ xem",
  topicsLabel: "Lọc theo chủ đề",
  sourceLabel: "Lọc theo nguồn",
  sourceAll: "Mọi nguồn",
  sourceTypes: "Loại nguồn",
  sourceFeeds: "Blog",
  typeNames: { rss: "Blog", hn: "Hacker News", "github-trending": "GitHub Trending", "github-release": "Bản phát hành" },
  topicAll: "Mọi chủ đề",
  topics: {
    "ai-workflow": "Cách làm việc với AI",
    "ai-tools": "Công cụ & agent",
    "ai-updates": "Cập nhật công cụ",
    career: "Nghề nghiệp",
    "ai-industry": "Tin ngành",
    "off-topic": "Lạc đề",
  },
  topicShort: {
    "ai-workflow": "Cách làm việc",
    "ai-tools": "Công cụ & agent",
    "ai-updates": "Cập nhật",
    career: "Nghề nghiệp",
    "ai-industry": "Tin ngành",
    "off-topic": "Lạc đề",
    "github-release": "Bản phát hành",
  },
  groups: {
    workflow: () => "Cách làm việc",
    career: () => "Nghề nghiệp",
    tools: () => "Công cụ & agent",
    releases: () => "Bản phát hành",
    industry: () => "Tin ngành",
  },
  dashboard: "Dashboard",
  settings: "Cài đặt",
  langSwitch: "Đổi sang tiếng Anh",
  themeToDark: "Chuyển sang giao diện tối",
  themeToLight: "Chuyển sang giao diện sáng",
  newSince: (n, since) => `${n} tin mới ${since}.`,
  newLead: {
    workflow: (n) => `${n} về cách làm việc với agent.`,
    career: (n) => `${n} về nghề nghiệp.`,
    releases: (n) => `${n} bản phát hành mới.`,
    tools: (n) => `${n} về công cụ và agent.`,
  },
  nothingNew: (since) => `Chưa có gì mới ${since}.`,
  firstVisit: (n) => `${n} tin về làm việc với AI đang có trong feed.`,
  firstVisitNote: "Lần sau bạn ghé lại, tin mới sẽ được đánh dấu.",
  longGapNote: (days) => `Feed chỉ giữ tin ${days} ngày gần nhất, nên đây là tất cả.`,
  neverFetched: "Chưa có tin nào.",
  neverFetchedNote: "Lần lấy tin đầu tiên chưa chạy. Tin sẽ xuất hiện sau lượt lấy tin kế tiếp.",
  updatedAgo: (ago) => `Cập nhật ${ago}`,
  catchUpLabel: "Tóm tắt từ lần ghé trước",
  newBadge: "Mới",
  video: "Video",
  readMinutes: (n) => `đọc ${n} phút`,
  videoMinutes: (n) => (n >= 60 ? `video ${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}` : `video ${n} phút`),
  sourcesCount: (n) => `${n} nguồn`,
  save: "Lưu để đọc sau",
  unsave: "Bỏ lưu",
  original: "Bản gốc",
  originalOf: (title) => `Mở bản gốc: ${title}`,
  translationPending: "Bản tiếng Việt chưa xong, đang hiện bản gốc.",
  releasesNew: (n) => `${n} bản mới`,
  releasesAll: (n) => `${n} bản`,
  showVersions: (n) => `Xem từng bản (${n})`,
  hideVersions: "Thu gọn",
  industry: "Tin ngành",
  industryMore: (n) => `Xem thêm ${n} tin`,
  industryLess: "Thu gọn",
  emptyNew: "Bạn đã xem hết tin mới.",
  emptyNewAction: "Xem tất cả tin",
  emptyFilter: "Không có tin nào khớp bộ lọc này.",
  emptyFilterAction: "Bỏ bộ lọc",
  emptySaved: "Chưa lưu tin nào.",
  emptySavedNote: "Bấm biểu tượng dấu trang ở một tin để đọc sau. Tin đã lưu nằm trong trình duyệt này và không bị xoá khi feed dọn tin cũ.",
  emptyStore: "Chưa có tin nào để hiển thị.",
  savedNote: "Lưu trong trình duyệt này.",
  loadingMore: "Đang tải thêm tin",
  justNow: "vừa xong",
  minutesAgo: (n) => `${n} phút trước`,
  hoursAgo: (n) => `${n} giờ trước`,
  yesterday: "hôm qua",
  daysAgo: (n) => `${n} ngày trước`,
  sinceToday: (time) => `kể từ ${time}\u00a0hôm nay`,
  sinceYesterday: (time) => `kể từ hôm qua lúc\u00a0${time}`,
  sinceWeekday: (weekday) => `kể từ ${weekday}`,
  sinceDate: (date) => `kể từ ${date}`,
  weekdays: ["Chủ Nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"],
  shortDate: (d) => `${d.getDate()}/${d.getMonth() + 1}`,
};

const en: Copy = {
  skip: "Skip to the feed",
  views: { new: "New", all: "All", saved: "Saved" },
  viewsLabel: "View",
  topicsLabel: "Filter by topic",
  sourceLabel: "Filter by source",
  sourceAll: "All sources",
  sourceTypes: "Source type",
  sourceFeeds: "Blogs",
  typeNames: { rss: "Blogs", hn: "Hacker News", "github-trending": "GitHub Trending", "github-release": "Releases" },
  topicAll: "All topics",
  topics: {
    "ai-workflow": "Working with AI",
    "ai-tools": "Tools & agents",
    "ai-updates": "Tool updates",
    career: "Career",
    "ai-industry": "Industry",
    "off-topic": "Off-topic",
  },
  topicShort: {
    "ai-workflow": "Working with AI",
    "ai-tools": "Tools & agents",
    "ai-updates": "Updates",
    career: "Career",
    "ai-industry": "Industry",
    "off-topic": "Off-topic",
    "github-release": "Release",
  },
  groups: {
    workflow: () => "Working with AI",
    career: () => "Career",
    tools: () => "Tools & agents",
    releases: () => "Releases",
    industry: () => "Industry",
  },
  dashboard: "Dashboard",
  settings: "Settings",
  langSwitch: "Switch to Vietnamese",
  themeToDark: "Switch to dark theme",
  themeToLight: "Switch to light theme",
  newSince: (n, since) => `${n} new ${n === 1 ? "item" : "items"} ${since}.`,
  newLead: {
    workflow: (n) => `${n} on working with agents.`,
    career: (n) => `${n} on careers.`,
    releases: (n) => `${n} new ${n === 1 ? "release" : "releases"}.`,
    tools: (n) => `${n} on tools and agents.`,
  },
  nothingNew: (since) => `Nothing new ${since}.`,
  firstVisit: (n) => `${n} items on working with AI in the feed right now.`,
  firstVisitNote: "Next time you come back, new items will be marked.",
  longGapNote: (days) => `The feed keeps only the last ${days} days, so this is everything.`,
  neverFetched: "Nothing here yet.",
  neverFetchedNote: "The first fetch hasn't run. Items appear after the next scheduled fetch.",
  updatedAgo: (ago) => `Updated ${ago}`,
  catchUpLabel: "Since your last visit",
  newBadge: "New",
  video: "Video",
  readMinutes: (n) => `${n} min read`,
  videoMinutes: (n) => (n >= 60 ? `video ${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}` : `video ${n} min`),
  sourcesCount: (n) => `${n} sources`,
  save: "Save for later",
  unsave: "Remove from saved",
  original: "Original",
  originalOf: (title) => `Open the original: ${title}`,
  translationPending: "",
  releasesNew: (n) => `${n} new`,
  releasesAll: (n) => `${n} releases`,
  showVersions: (n) => `Show each release (${n})`,
  hideVersions: "Collapse",
  industry: "Industry",
  industryMore: (n) => `${n} more`,
  industryLess: "Show less",
  emptyNew: "You're all caught up.",
  emptyNewAction: "See all items",
  emptyFilter: "Nothing matches this filter.",
  emptyFilterAction: "Clear filters",
  emptySaved: "Nothing saved yet.",
  emptySavedNote: "Tap the bookmark on an item to read it later. Saved items stay in this browser and survive the feed's cleanup.",
  emptyStore: "Nothing to show yet.",
  savedNote: "Saved in this browser.",
  loadingMore: "Loading more items",
  justNow: "just now",
  minutesAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  yesterday: "yesterday",
  daysAgo: (n) => `${n}d ago`,
  sinceToday: (time) => `since ${time}\u00a0today`,
  sinceYesterday: (time) => `since yesterday at\u00a0${time}`,
  sinceWeekday: (weekday) => `since ${weekday}`,
  sinceDate: (date) => `since ${date}`,
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDate: (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
};

export function homeCopy(language: Language): Copy {
  return language === "vi" ? vi : en;
}

export type HomeCopy = Copy;
