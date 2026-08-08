# Discord TTS Bot

Bot đọc tin nhắn chat trong voice channel Discord, kèm một app desktop (Electron) có nút Bật/Tắt và cửa sổ log.

## Chạy ở chế độ dev

```bash
npm install
cp .env.example .env   # rồi điền DISCORD_TOKEN và CLIENT_ID
npm run dev            # chạy bot bằng terminal, không có giao diện
npm run desktop        # chạy app desktop có giao diện
```

## Build file .exe

Có 2 bản build, khác nhau ở chỗ token nằm ở đâu.

### Bản riêng — dùng cho chính mình

```bash
npm run dist
```

Kết quả: `release/DiscordTTSBot.exe`. Token được nhúng sẵn bên trong, mở lên là bot chạy luôn, không cần file phụ nào.

> ⚠️ **Tuyệt đối không chia sẻ file này.** Token nằm bên trong và trích xuất được chỉ bằng một lệnh (`npx asar extract-file ... embedded-env.json`). Ai có file cũng chiếm được quyền điều khiển bot.

### Bản chia sẻ — gửi cho người khác host hộ

```bash
npm run dist:share
```

Kết quả: `release/DiscordTTSBot-Share.exe`. **Không chứa token**, nên gửi công khai thoải mái. Khi chạy nó sẽ tìm file `.env` đặt cùng thư mục với file `.exe`:

```
DiscordTTSBot-Share.exe
.env                       ← gửi riêng, chỉ cho người tin tưởng
```

Mẫu `.env` có sẵn ở [desktop/env-template.txt](desktop/env-template.txt).

> ⚠️ **Mỗi lúc chỉ được 1 người chạy.** Bot Discord là một tiến trình phục vụ cả server — nếu 2 người chạy cùng token cùng lúc, bot sẽ đọc mỗi tin nhắn 2 lần và tranh nhau vào voice channel.

Repo an toàn trong cả 2 trường hợp: `.env`, `desktop/embedded-env.json` và `release/` đều nằm trong `.gitignore`.

## Dữ liệu khi chạy

App desktop lưu `data/` (cấu hình từng server) và `tts_cache/` trong thư mục user data của Windows, không nằm cạnh file `.exe`. Bấm **Mở thư mục dữ liệu** trong app để xem:

```
%APPDATA%\discord-bot\
```

## Cấu trúc

| Đường dẫn | Vai trò |
| --- | --- |
| `src/` | Mã nguồn bot (TypeScript) |
| `desktop/` | App Electron: `main.js` quản lý tiến trình bot, `renderer/` là giao diện |
| `scripts/prepare-env.js` | Nhúng `.env` vào app trước khi đóng gói |
