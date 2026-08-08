# Discord TTS Bot

Bot đọc tin nhắn chat trong voice channel Discord, kèm một app desktop (Electron) có nút Bật/Tắt và cửa sổ log.

## Yêu cầu hệ thống

| Thứ cần có | Phiên bản | Ghi chú |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | >= 20 (đang dùng v24) | Kèm sẵn `npm` |
| Git | bất kỳ | Để clone repo |
| Windows | 10/11 x64 | Chỉ cần khi build `.exe` (`npm run dist`) |
| ffmpeg | — | **Không cần cài riêng**, đã có sẵn qua `ffmpeg-static` |

## Thư viện cần cài

Toàn bộ đã khai báo trong `package.json`, chỉ cần chạy **một lệnh**:

```bash
npm install
```

Danh sách để tham khảo (không cần cài tay từng cái):

### Dependencies — bắt buộc để bot chạy

| Thư viện | Vai trò |
| --- | --- |
| `discord.js` | Client Discord, slash command, đọc tin nhắn |
| `@discordjs/voice` | Kết nối voice channel, phát audio |
| `libsodium-wrappers` | Mã hoá gói tin voice (Discord bắt buộc) |
| `ffmpeg-static` | Binary ffmpeg đi kèm để transcode audio |
| `undici` | HTTP client gọi API TTS, có connection pool |
| `quick-lru` | Cache TTS trong RAM |
| `dotenv` | Đọc biến môi trường từ `.env` |

### DevDependencies — chỉ cần khi dev/build

| Thư viện | Vai trò |
| --- | --- |
| `typescript` | Biên dịch `src/` → `dist/` |
| `ts-node`, `ts-node-dev` | Chạy thẳng TypeScript khi dev (`npm run dev` / `watch`) |
| `@types/node`, `@types/libsodium-wrappers` | Type definitions |
| `electron` | Chạy app desktop |
| `electron-builder` | Đóng gói ra file `.exe` |

### Tuỳ chọn — chưa cài, cài thêm nếu cần

Repo có sẵn file cấu hình nhưng **chưa khai báo trong `package.json`**:

```bash
npm i -D eslint @eslint/js prettier   # cho eslint.config.mjs và .prettierrc
npm i -g pm2                          # cho ecosystem.config.js, khi deploy lên VPS Linux
```

## Chạy ở chế độ dev

```bash
npm install
cp .env.example .env   # rồi điền DISCORD_TOKEN và CLIENT_ID
npm run dev            # chạy bot bằng terminal, không có giao diện
npm run desktop        # chạy app desktop có giao diện
```

## Biến môi trường

Chỉ 2 biến đầu là bắt buộc, còn lại có giá trị mặc định (xem [src/config.ts](src/config.ts)).

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `DISCORD_TOKEN` | **bắt buộc** | Token bot từ Discord Developer Portal |
| `CLIENT_ID` | **bắt buộc** | Application ID của bot |
| `DEV_GUILD_ID` | — | Server test: đăng ký slash command tức thì thay vì chờ global |
| `IDLE_TIMEOUT_MS` | `300000` | Rời voice channel sau bao lâu không dùng (ms) |
| `MAX_QUEUE` | `30` | Số câu tối đa trong hàng đợi mỗi server |
| `MAX_GLOBAL_QUEUE` | `200` | Hàng đợi tối đa toàn bot |
| `MAX_INPUT_LEN` | `350` | Độ dài tối đa một câu được đọc |
| `USER_COOLDOWN` | `900` | Thời gian chờ giữa 2 lần đọc của cùng 1 user (ms) |
| `CACHE_DIR` | `./tts_cache` | Thư mục cache audio trên đĩa |
| `ENABLE_DISK_CACHE` | `false` | Bật cache audio ra đĩa |
| `MEMORY_CACHE_SIZE` | `1000` | Số audio giữ trong RAM |
| `TTS_FETCH_TIMEOUT_MS` | `10000` | Timeout mỗi request TTS |
| `TTS_MAX_CONCURRENT_FETCHES` | `8` | Số request TTS chạy song song |
| `TTS_HTTP_CONNECTIONS` | `12` | Số kết nối trong pool của `undici` |
| `MAX_GUILD_TEXTS_TRACKED` | `200` | Số kênh text theo dõi mỗi server |

> Lưu ý: `DEFAULT_TTS_ENGINE`, `DEFAULT_GENDER`, `DEFAULT_SPEED` có trong `.env.example` nhưng hiện **không được code đọc tới** — cài đặt giọng nói lưu theo từng server trong `data/`.

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
