# Kết quả triage (2026-11-16)

82 tin thật, chấm bằng thanh triage tạm (`.triage/decisions.json`). Tất cả 82 tin đều có tóm tắt AI.

## Phân bố quyết định

| Quyết định | Số tin | Tỉ lệ |
|---|---|---|
| Bỏ qua | 24 | 29% |
| Lướt là đủ | 44 | 54% |
| Đọc kỹ | 11 | 13% |
| Lưu / thử ngay | 3 | 4% |

Người đọc chủ yếu **lướt**: 83% số tin được quyết định ngay trên thẻ (bỏ qua hoặc lướt là đủ).

## Phát hiện

### 1. Tiêu đề và tóm tắt quyết định gần như mọi thứ
- "Tiêu đề đủ rõ" và "Tóm tắt đủ hiểu" có mặt trong hầu hết các quyết định tích cực: lướt 22–23/44, đọc kỹ 9–10/11, thử ngay 2–3/3.
- Tóm tắt dở thì người đọc bỏ qua ngay. `beer.drv.drv.drv` (Lobsters): "Tiêu đề không hiểu, summary không giúp được gì, có vẻ là do không lấy được nội dung gốc."

### 2. Điểm HN và sao GitHub không dự đoán được quyết định
- Lý do "Điểm HN / sao GitHub cao" được chọn **0 lần**.
- Hacker News: tin bỏ qua có tới 356 điểm, tin thử ngay chỉ có 7–8 điểm.
- GitHub Trending: tin bỏ qua có tới 2.217 sao, tin lướt có 1.0–1.6k sao.

### 3. Bộ lọc là vấn đề lớn nhất, không phải giao diện
- 18/24 tin bỏ qua có lý do "Không liên quan AI dev".
- Tin **không có topic nào**: 18 bỏ qua, 11 lướt, **0 đọc kỹ, 0 thử ngay**.
- Topic sai do so khớp từ khoá: tin tên lửa Vulcan bị gắn `ai-updates` (2 lần), `cursor:pointer on buttons` bị gắn `ai-tools`, `clice v1.0 Released` bị gắn `ai-updates`.
- Lobsters: 7/8 tin bị bỏ qua.
- GitHub Trending: 5/12 tin bị bỏ qua vì không liên quan AI (TelemetryCleaner, mkw-recomp, WQFiles…).

### 4. Sản phẩm và công ty là tín hiệu mạnh nhất sau tiêu đề và tóm tắt
- "Sản phẩm / công ty tôi theo dõi" xuất hiện ở 20 tin lướt và 4 tin đọc kỹ.
- Thực thể lặp lại nhiều: Claude / Anthropic, OpenAI / ChatGPT / Codex, Nvidia, GitHub, DeepSeek.

### 5. Tỉ lệ đọc khác nhau theo topic

| Topic | Đọc kỹ + thử ngay / tổng |
|---|---|
| `ai-workflow` | 6/15 |
| `career` | 3/7 |
| `ai-tools` | 13/47 |
| `ai-updates` | 4/21 |

Tin về cách làm việc với agent và tin nghề nghiệp có tỉ lệ đọc kỹ cao nhất. Bài đọc kỹ đến từ Pragmatic Engineer, GitHub Blog, Stack Overflow Blog, Simon Willison, Show HN.

### 6. Bản phát hành: chỉ cần biết là có bản mới
- 5/5 tin release được chấm "lướt".
- Claude Code v2.1.323 và v2.1.325, OpenHands v1.39.0 và v1.40.0: nhiều phiên bản của cùng một repo nằm thành các thẻ riêng.

### 7. Tin trùng: cùng một sự kiện từ nhiều nguồn
- Tên lửa Vulcan: Ars Technica, HN, The Verge (3 thẻ).
- ChatGPT Wallet: OpenAI News, The Verge (cả hai được đọc kỹ).
- Jensen Huang quay lại Nvidia: HN (đọc kỹ), The Verge (lướt), cùng các tin Nvidia liên quan.
- Đây đúng là những "tin lớn" mà PRODUCT.md muốn giữ cho tin ngành.

### 8. Tin ngành chủ yếu là "biết là đủ"
- "Model / lab lớn" có 10 lần ở tin lướt và 4 lần ở tin đọc kỹ.
- "Tin ngành nhưng quá nhỏ" có 6 lần.
- Điều này xác nhận cách xử lý "nhóm phụ, hiển thị gọn".

### 9. Ảnh, nguồn, share hầu như không ảnh hưởng
- "Có ảnh / video": 1 lần.
- "Nguồn uy tín": 2 lần.
- Share: 0 tin. Bạn bè tự vào site nên không cần tính năng share.
- Video dài bị bỏ qua vì không biết trước độ dài: "Nội dung gốc là 1 video quá dài (1h40p) nên không xem."

### 10. OpenAI News chủ yếu là câu chuyện khách hàng
9/10 tin là "lướt". Phần lớn là bài kể chuyện khách hàng dùng OpenAI (Gondola, Holiday Extras, Gilbert + Tobin, JioStar, Shield, Amplitude), khác với các bài ra mắt sản phẩm.

## Đề xuất các trường hiển thị

### Thẻ tin (luôn hiện)
1. **Tiêu đề**: tiếng Việt, giữ thuật ngữ gốc.
2. **Tóm tắt 1–2 câu**: phần quan trọng nhất. Ẩn hoặc đánh dấu tin không lấy được nội dung gốc thay vì hiện một tóm tắt vô nghĩa.
3. **Thực thể**: các chip Claude, OpenAI, Nvidia…
4. **Loại tin**: công cụ / repo, bản phát hành, cách làm việc, nghề nghiệp, tin ngành, case study.
5. **Nguồn + thời gian**: nhỏ, phụ.
6. **"N nguồn cùng đưa tin"**: chỉ hiện khi tin đã được gộp.
7. **Độ dài**: chỉ cho video và bài dài ("video 1h40", "đọc 12 phút").

### Không nên hiện trên thẻ
- Điểm HN và sao GitHub: không giúp quyết định. Chỉ dùng ở phía sau để sắp xếp, hoặc để ở trang chi tiết.
- Ảnh lớn: không giúp quyết định và chiếm chỗ khi lướt. Có thể dùng ảnh nhỏ hoặc bỏ.
- Điểm liên quan dạng số.
- Nút share.

### Gom nhóm
- Tin release: gộp theo repo ("Claude Code: 2 bản mới, v2.1.323 → v2.1.325").
- Tin ngành: một khu gọn riêng, mỗi tin một dòng.
- Tin trùng: một thẻ cho mỗi sự kiện, kèm danh sách nguồn.

## Việc cần làm cho pipeline (trước hoặc song song với redesign)
1. Ẩn mặc định tin không có topic. Theo số liệu triage, việc này loại 18/24 tin bỏ qua mà không mất tin đọc kỹ nào.
2. Sửa so khớp từ khoá: dùng ranh giới từ, bỏ các từ quá chung như `update` và `launch`.
3. Lọc GitHub Trending theo mức liên quan tới AI.
4. Xem lại việc giữ Lobsters.
5. Gộp tin trùng theo sự kiện.
6. Thêm trường loại tin và thực thể vào bước phân loại bằng Groq.
7. Đánh dấu tin không lấy được nội dung gốc.
