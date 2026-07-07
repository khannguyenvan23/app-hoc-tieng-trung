# Giám sát production

## Sentry

Tạo một project Next.js trên Sentry, sau đó thêm các biến sau vào Vercel cho
Production và Preview:

```text
NEXT_PUBLIC_SENTRY_DSN=<DSN của project>
SENTRY_DSN=<cùng DSN>
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ENVIRONMENT=production
SENTRY_ORG=<organization slug>
SENTRY_PROJECT=<project slug>
SENTRY_AUTH_TOKEN=<token dùng upload source map>
```

`SENTRY_AUTH_TOKEN` là bí mật, không dùng tiền tố `NEXT_PUBLIC_`. Sau khi thêm
biến, redeploy rồi xem lỗi trong Sentry Issues và độ trễ trong Traces.

## Vercel

- Runtime errors: Project > Logs, lọc `Environment = production` và
  `Level = error, warning`.
- Hiệu năng thực tế: Project > Speed Insights.
- CLI: `npx vercel logs --project app-hoc-tieng-trung --environment production --since 1h`.

## Resend

Vào Resend > Emails để xem trạng thái `delivered`, `bounced`, `failed` hoặc
`suppressed`. Mở menu của một email và chọn `View log` để xem lỗi SMTP cụ thể.

## Lighthouse mobile

```powershell
npx --yes lighthouse@latest https://www.tiengtrunghihi.com `
  --form-factor=mobile `
  --only-categories=performance,accessibility,best-practices,seo `
  --output=html `
  --output-path=lighthouse-mobile.html `
  --chrome-flags="--headless --no-sandbox"
```
