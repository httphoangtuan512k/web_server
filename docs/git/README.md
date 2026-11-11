# Git – đưa code lên GitHub

## Mỗi ngày làm 5 bước

```bash
git pull                          # 1. Lấy code mới nhất về (làm TRƯỚC khi sửa)
#    … sửa code, lưu file …
git status                        # 2. Xem đã sửa file nào
git add .                         # 3. Chọn tất cả thay đổi
git commit -m "Mô tả việc đã làm"  # 4. Lưu lại
git push                          # 5. Đẩy lên GitHub (web tự cập nhật)
```

## Bằng chuột trong VS Code

Mở **Source Control** (Ctrl+Shift+G) → bấm **+** cạnh *Changes* → gõ mô tả → **✓ Commit** → **Sync Changes**.

## Lần đầu trên máy mới

```bash
git clone https://github.com/httphoangtuan512k/web_server.git
cd web_server
npm install
npm run dev                       # mở http://localhost:3000
```

## Gặp lỗi

| Thấy | Làm |
|---|---|
| `rejected` / `fetch first` | `git pull` rồi `git push` lại |
| `CONFLICT` | Mở file, giữ phần đúng, xóa dòng `<<<<<<<` `=======` `>>>>>>>`, rồi add → commit → push |
| `Permission denied` | Nhờ chủ repo mời tài khoản GitHub của bạn (Settings → Collaborators) |
| `nothing to commit` | Không có gì mới – không phải lỗi |

⚠ Không dùng `git push --force`, `git reset --hard`. Không đưa file `.env` (mật khẩu) lên GitHub.
