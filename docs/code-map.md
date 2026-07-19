# Ban do code Tieng Trung Hihi

File nay giup doc code theo luong thuc te, khong can mo tung file tu tren xuong. Khi gap bug, hay tim theo cau hoi: nguoi dung dang o man nao, man do goi API nao, API do ghi bang nao, logic tinh nam o file nao.

## Doc tu dau truoc

Thu tu de hieu nhanh nhat:

1. `test/srs-logic.test.ts`
   - Doc cac vi du SRS truoc. Day la cach de hieu "Quen/Kho/Nho/De" ma khong bi ngop UI.

2. `src/lib/review.ts`
   - Ham quan trong nhat: `getNextReview`.
   - File nay tinh lan on tiep theo: `next_review_at`, `interval_days`, `ease_factor`.

3. `src/lib/study-queue.ts`
   - File nay xep hang hoc: lay bao nhieu the moi, the nao den han, the nao dang cho vai phut.

4. `src/app/study/page.tsx`
   - Man on tu vung.

5. `src/app/study-sentences/page.tsx`
   - Man luyen cau.

6. `src/app/api/review/route.ts` va `src/app/api/review-sentence/route.ts`
   - API luu ket qua khi bam Quen/Kho/Nho/De.

Neu chi muon sua bug SRS, thuong chi can doc 4 file: `review.ts`, `study-queue.ts`, `study/page.tsx`, `study-sentences/page.tsx`.

## Cau truc lon

### `src/app`

Day la cac trang va API theo Next.js App Router.

- `src/app/page.tsx`
  - Landing page cong khai.

- `src/app/login/page.tsx`
  - Dang nhap, dang ky, quen mat khau.

- `src/app/dashboard/page.tsx`
  - Trang bo the, bo mau, streak, bo the cong dong, can hoc lai.

- `src/app/study/page.tsx`
  - Hoc tu vung flashcard.

- `src/app/study-sentences/page.tsx`
  - Luyen cau, nghe audio, chinh ta, viet, pinyin.

- `src/app/options/page.tsx`
  - Cai dat gioi han hoc moi ngay va thong so SRS kieu Anki.

- `src/app/statistics/page.tsx`
  - Thong ke hoc va analytics.

- `src/app/pricing/page.tsx`
  - Nap credit, goi credit, so dien thoai/Zalo.

- `src/app/community/page.tsx`
  - Bo the cong dong/chia se.

- `src/app/decks/[deckId]/page.tsx`
  - Chi tiet bo the: xem, sua, xoa, import.

### `src/app/api`

Day la backend API cua app.

- `review/route.ts`
  - Luu ket qua on tu vung.

- `review-sentence/route.ts`
  - Luu ket qua luyen cau.

- `study-settings/route.ts`
  - Lay/luu cai dat hoc moi ngay va SRS.

- `import-vocabulary/route.ts`
  - Import tu vung bang AI.

- `import-words-to-sentences/route.ts`
  - Tu danh sach tu, AI tao cau luyen tap.

- `import-sentences/route.ts`
  - Import cau tieng Trung co san.

- `manual-sentence/route.ts`
  - Them cau thu cong.

- `ensure-card-audio/route.ts`
  - Tao audio cho the tu vung neu chua co.

- `ensure-sentence-audio/route.ts`
  - Tao audio cho cau neu chua co.

- `template-decks/route.ts`
  - Lay/copy bo the mau HSK, cau thuong ngay, v.v.

- `deck-shares/route.ts`
  - Tao va lay link chia se bo the.

- `deck-actions/route.ts`
  - Reset tien do, xoa deck, xoa noi dung trong deck.

- `credits/route.ts`
  - Lay thong tin credit.

- `analytics/route.ts`, `analytics/report/route.ts`, `statistics/route.ts`
  - Ghi va doc thong ke.

### `src/lib`

Day la logic dung chung. Khi bug nam o "cach tinh", hay xem o day truoc.

- `review.ts`
  - Bo nao SRS.
  - `getNextReview(rating, state, now, settings)` tinh lan hoc tiep theo.

- `study-queue.ts`
  - Xep hang hoc.
  - `buildStudyQueue` tron review den han va the moi theo gioi han moi ngay.
  - `shouldRequeueInCurrentSession` quyet dinh Quen/Kho co giu trong phien hien tai khong.
  - `getNextStudyQueueIndex` bo qua item chua toi gio.

- `study-settings.ts`
  - Gia tri mac dinh va normalize cai dat SRS.
  - Xu ly learning steps, relearning steps, graduating interval, easy interval.

- `study-session.ts`
  - Luu phien dang hoc vao `localStorage`.
  - Giu lai cau/the dang hoc khi chuyen trang hoac reload.

- `review-queue-stats.ts`
  - Dem 3 o duoi card: Moi, Dang on, Review.

- `sentence-diff.ts`
  - Kiem tra chinh ta cau tieng Trung: dung, sai, thieu, go du.

- `ai.ts`
  - Goi OpenAI de tao tu/cau/pinyin/nghia.

- `tts.ts`
  - Tao audio va upload len Supabase Storage.

- `credits.ts`
  - Tru/hoan credit cho AI va audio.

- `analytics.ts`, `analytics-client.ts`
  - Theo doi dang ky, hoc dau tien, active day.

- `supabase/browser.ts`, `supabase/server.ts`, `supabase/admin.ts`
  - Tao Supabase client theo tung moi truong.

- `types.ts`
  - Kieu du lieu chinh: `Deck`, `Card`, `Review`, `SentenceCard`, `SentenceReview`.

### `src/components`

Component UI dung lai.

- `app-shell.tsx`
  - Khung app sau khi dang nhap, menu tren cung.

- `auth-guard.tsx`
  - Chan trang can dang nhap.

- `review-queue-status.tsx`
  - 3 o `Moi / Dang on / Review`.

- `study-progress.tsx`
  - Thanh tien do trong card hoc.

- `loading-skeletons.tsx`
  - Skeleton khi dang tai.

- `zalo-floating-contact.tsx`
  - Nut Zalo goc man hinh.

## Luong on tu vung

Nguoi dung vao `/study`.

1. `src/app/study/page.tsx`
   - `loadReviews()` lay danh sach `reviews` + `cards`.
   - Goi `buildStudyQueue()` de xep hang.
   - Goi `getStoredReviewIndex()` de khoi phuc the dang hoc.

2. Nguoi dung bam `Hien dap an`.
   - UI hien chu Han, pinyin, cau vi du, audio.

3. Nguoi dung bam `Quen/Kho/Nho/De`.
   - Ham `rate(rating)` chay trong `study/page.tsx`.
   - Goi `getNextReview()` de tinh lich tiep theo ngay tren client cho UI chay nhanh.
   - Goi API `POST /api/review` de luu vao database.

4. API `src/app/api/review/route.ts`
   - Kiem tra user.
   - Lay row trong `reviews`.
   - Lay `user_study_settings`.
   - Goi lai `getNextReview()` tren server.
   - Update `reviews`: `next_review_at`, `interval_days`, `ease_factor`, `review_count`, `last_rating`.

## Luong luyen cau

Nguoi dung vao `/study-sentences`.

1. `src/app/study-sentences/page.tsx`
   - `loadReviews()` lay `sentence_reviews` + `sentence_cards`.
   - `buildSentenceStudyQueue()` goi chung `buildStudyQueue()`.

2. Che do binh thuong
   - Mat truoc la nghia tieng Viet.
   - Bam `Hien dap an` hien cau tieng Trung, pinyin, audio, tu vung trong cau.

3. Che do chinh ta
   - Nguoi dung nghe audio va go cau tieng Trung.
   - `compareChineseSentences()` trong `sentence-diff.ts` kiem tra tung phan dung/sai/thieu/du.

4. Bam `Quen/Kho/Nho/De`
   - Ham `rate(rating)` trong `study-sentences/page.tsx`.
   - API luu la `POST /api/review-sentence`.
   - Bang database la `sentence_reviews`.

## SRS doc nhu the nao

Rating co 4 gia tri:

- `again` = Quen
- `hard` = Kho
- `good` = Nho
- `easy` = De

Trong `src/lib/review.ts`:

- Neu `interval_days <= 0`, item dang la the/cau moi hoac dang hoc buoc ngan.
  - `again`: quay lai sau learning step dau tien.
  - `hard`: quay lai sau learning step thu hai.
  - `good`: tot nghiep, quay lai sau `graduating_interval_days`.
  - `easy`: tot nghiep nhanh, quay lai sau `easy_interval_days`.

- Neu `interval_days > 0`, item da la review that.
  - `again`: vao relearning, quay lai sau `relearning_steps`.
  - `hard`: tang interval cham.
  - `good`: tang interval theo ease.
  - `easy`: tang interval nhanh hon good.

Can nho:

- `next_review_at` quyet dinh luc nao item hien lai.
- `review_count = 0` la item moi.
- `interval_days = 0` thuong la item dang hoc trong phien ngan.
- `interval_days > 0` la item da tot nghiep thanh review.

## 3 o Moi / Dang on / Review

File: `src/lib/review-queue-stats.ts`

- `Moi`
  - `review_count = 0`

- `Dang on`
  - `review_count > 0`
  - va `interval_days <= 0` hoac `last_rating = again`

- `Review`
  - `review_count > 0`
  - va `interval_days > 0`
  - va da den han trong hang dang load

Luu y: `Review` chi la review dang co trong hang hien tai. Neu mot cau duoc hen ngay mai thi hom nay khong nam trong hang, nen so Review co the la 0.

## Gioi han hoc moi ngay

File lien quan:

- `src/app/options/page.tsx`
- `src/lib/study-settings.ts`
- `src/lib/study-queue.ts`
- `src/app/study/page.tsx`
- `src/app/study-sentences/page.tsx`

Logic:

1. Lay setting tu `/api/study-settings`.
2. Dem so the/cau moi da hoc hom nay bang `first_reviewed_at`.
3. Tinh:

```text
remainingNewItems = daily_new_limit - studiedToday
```

4. `buildStudyQueue()` chi dua vao hang toi da `remainingNewItems` item moi.
5. Review den han khong bi gioi han boi daily new limit.

## Import AI va credit

### Import tu vung

- UI: `src/app/decks/[deckId]/import/page.tsx`
- API preview: `src/app/api/preview-vocabulary/route.ts`
- API luu: `src/app/api/import-vocabulary/route.ts`
- AI: `src/lib/ai.ts`
- Credit: `src/lib/credits.ts`
- Audio: `src/lib/tts.ts`

### Import tu thanh cau

- UI: `src/app/decks/[deckId]/import-words-to-sentences/page.tsx`
- API: `src/app/api/import-words-to-sentences/route.ts`

### Import cau co san

- UI: `src/app/decks/[deckId]/import-sentences/page.tsx`
- API: `src/app/api/import-sentences/route.ts`

### Them cau thu cong

- UI: `src/app/decks/[deckId]/sentences/manual/new/page.tsx`
- API: `src/app/api/manual-sentence/route.ts`

## Audio

File lien quan:

- `src/lib/tts.ts`
- `src/app/api/ensure-card-audio/route.ts`
- `src/app/api/ensure-sentence-audio/route.ts`
- `src/app/api/regenerate-card-audio/route.ts`
- `src/app/api/regenerate-sentence-audio/route.ts`
- `scripts/prepare-template-audio.ts`

Logic:

- Khi import hoac them thu cong, app co the tao audio va luu URL vao Supabase.
- Khi hoc ma audio chua co, API `ensure-*` tao bo sung.
- Bo mau nen chay truoc `npm run audio:templates` de tao audio san, tranh moi user hoc lai goi TTS.

## Template deck va chia se

### Bo the mau

- API: `src/app/api/template-decks/route.ts`
- Data SQL: `supabase/migrations/004_template_decks.sql` va cac migration HSK/cau mau phia sau.

Khi user bam "Them bo nay":

1. Copy deck mau thanh deck rieng cua user.
2. Copy cards/sentence_cards.
3. Tao review rows rieng cho user.
4. Tien do SRS khong dung chung giua cac user.

### Chia se deck

- API: `src/app/api/deck-shares/route.ts`
- Trang xem share: `src/app/shared-decks/[token]/page.tsx`
- Trang cong dong: `src/app/community/page.tsx`
- Migration: `supabase/migrations/019_deck_sharing.sql`

Khi user khac copy deck chia se:

- Noi dung duoc copy.
- Tien do hoc bat dau moi.
- Audio URL co the duoc dung lai neu da luu trong card.

## Database doc o dau

Thu muc: `supabase/migrations`

Nhung bang quan trong:

- `decks`
  - Bo the cua user.

- `cards`
  - Tu vung.

- `reviews`
  - Lich on tu vung.

- `sentence_cards`
  - Cau luyen tap.

- `sentence_reviews`
  - Lich on cau.

- `user_study_settings`
  - Cai dat gioi han moi ngay va SRS.

- `credits`, `credit_transactions`
  - Credit AI/audio.

- `template_decks`, `template_cards`, `template_sentence_cards`
  - Bo mau.

- `deck_shares`
  - Link chia se.

- `analytics_events`
  - Theo doi hanh vi nguoi dung.

## Khi bug SRS thi debug nhu sau

1. Xac dinh man:
   - Tu vung: `/study`
   - Cau: `/study-sentences`

2. Xac dinh deck dang chon:
   - Xem dropdown trong UI.
   - Hoac localStorage:
     - Tu vung: `hanzi-study-deck-id`
     - Cau: `hanzi-sentence-study-deck-id`

3. Xem queue duoi card:
   - Moi
   - Dang on
   - Review

4. Kiem tra database:
   - `review_count`
   - `interval_days`
   - `last_rating`
   - `next_review_at`
   - `first_reviewed_at`

5. Doi chieu:
   - Item moi ma khong hien: co vuot daily limit khong?
   - Dang on ma hien qua som: xem `next_review_at` va `getNextStudyQueueIndex`.
   - Review khong hien: co den han chua?
   - Copy deck ma khong co review: dung, vi tien do la rieng moi user.

6. Chay test:

```bash
npm run test:srs
```

7. Neu sua code:

```bash
npm run lint
npm run build
```

## Khi bug import

1. Xac dinh import loai nao:
   - Tu vung: `import-vocabulary`
   - Tu thanh cau: `import-words-to-sentences`
   - Cau co san: `import-sentences`
   - Thu cong: `manual-sentence`

2. Xem credit:
   - `src/lib/credits.ts`
   - Bang `credits`, `credit_transactions`

3. Xem AI:
   - `src/lib/ai.ts`

4. Xem audio:
   - `src/lib/tts.ts`
   - Supabase Storage bucket audio

5. Xem review row co duoc tao khong:
   - Tu vung: `reviews`
   - Cau: `sentence_reviews`

## Khi bug audio

1. Card co URL chua?
   - Tu vung: `word_audio_url`, `sentence_audio_url`
   - Cau: `sentence_audio_url`

2. Neu chua co URL:
   - API `ensure-card-audio` hoac `ensure-sentence-audio` se tao.

3. Neu load cham:
   - Tao audio san bang script template.
   - Preload audio hien tai va 1-2 item tiep theo trong page hoc.

4. Neu ton credit:
   - Kiem tra `credits.ts` va API ensure/import.

## Khi bug auth/reset password/email

File lien quan:

- `src/app/login/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/supabase/browser.ts`
- Supabase Auth settings

Can kiem tra:

- Supabase Site URL
- Supabase Redirect URLs
- SMTP Resend/Brevo/SendGrid
- Email template dung link nao

## Khi bug giao dien

File lien quan:

- UI rieng tung trang: `src/app/.../page.tsx`
- CSS chung: `src/app/globals.css`
- Component dung lai: `src/components`

Nen sua o component chung neu nhieu man cung dung. Vi du:

- Thanh tien do: `study-progress.tsx`
- 3 o queue: `review-queue-status.tsx`
- Shell menu: `app-shell.tsx`
- Skeleton: `loading-skeletons.tsx`

## Lenh hay dung

Tim file:

```bash
rg --files
```

Tim chu trong code:

```bash
rg "getNextReview" src test
```

Test SRS:

```bash
npm run test:srs
```

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

## Quy tac de khong bi lac

Dung doc ca file lon ngay tu dau. Hay bam theo chuoi:

```text
UI -> API -> lib logic -> database -> test
```

Vi du bug "bam Nho sao ngay mai khong hien":

1. UI: `study-sentences/page.tsx`, ham `rate`.
2. Logic: `review.ts`, ham `getNextReview`.
3. API: `api/review-sentence/route.ts`.
4. Database: `sentence_reviews.next_review_at`.
5. Test: `test/srs-logic.test.ts`.

Vi du bug "dang on hien lai qua som":

1. UI: `study-sentences/page.tsx`, ham `rate`.
2. Queue: `study-queue.ts`, `getNextStudyQueueIndex`.
3. Session: `study-session.ts`, queue luu trong localStorage.
4. Test: `study queue skips learning items until their scheduled time`.

## Nen nho 6 file quan trong nhat

Neu chi duoc hoc 6 file, hoc 6 file nay:

1. `src/lib/review.ts`
2. `src/lib/study-queue.ts`
3. `src/lib/study-settings.ts`
4. `src/lib/study-session.ts`
5. `src/app/study/page.tsx`
6. `src/app/study-sentences/page.tsx`

Hieu 6 file nay la da nam duoc loi app hoc tap.
