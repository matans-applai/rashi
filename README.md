# RASHI-BOT — קרן רש"י, בוט ניתוב פניות (POC)

POC קצר ועברי-RTL לעובדי קרן רש"י: פתיחת פנייה לגבי התקשרות עם ספק / יועץ / שירות,
העלאת מסמכים, סיווג ראשוני אוטומטי, והעברה (במידת הצורך) לבדיקה משפטית קצרה.

המטרה: לקבל פידבק מהמחלקה המשפטית ולחדד את ההגדרות לפני שמחליפים את הסיווג הראשוני במודל LLM אמיתי.

---

## Stack

- **React 18 + Vite + TypeScript** (web app)
- **Tailwind CSS** (RTL, גופן Heebo)
- **React Router**
- **Supabase**: Auth, Database (Postgres), Storage
- **Rules-based classifier** (פונקציה טהורה ב-`src/lib/classifier.ts`) — מוכן להחלפה ב-LLM

---

## Architecture at a glance

```
src/
  App.tsx                  Routes
  lib/
    classifier.ts          ← הסיווג הראשוני: מילות-מפתח, סכום, סטטוס ספק
    insights.ts            ← תובנות קצרות מתוך המלל החופשי לעמוד הסיכום
    suppliers.ts           ← רשימת ספקי דמו לחיפוש לפי שם
    types.ts               ← Types מרכזיים (RoutingOutcome, RequestRecord...)
    requests.ts            ← CRUD על טבלת requests ו-storage
    supabase.ts            ← Client ו-config
    auth.tsx               ← AuthProvider עם Supabase auth
  components/
    Layout.tsx, OutcomeBadge.tsx, ConfigBanner.tsx
  pages/
    Login.tsx
    Dashboard.tsx          ← רשימת פניות
    NewRequest.tsx         ← הטופס הקצר
    RequestSummary.tsx     ← הסיווג הראשוני וההמלצה
    LegalIntake.tsx        ← 3 כרטיסים, לא 20 שאלות
    LegalConfirmation.tsx  ← סיכום לפני שליחה / מסך אישור
```

### החלפה ב-LLM בעתיד
`src/lib/classifier.ts` מייצא `classifyRequest(input)` כפונקציה טהורה.
כדי להחליף ב-LLM: ממשו `classifyWithLLM(input)` עם אותה חתימה (ראו ה-stub בתחתית הקובץ),
וקראו לה במקום `classifyRequest` ב-`src/pages/NewRequest.tsx`.

---

## הגדרה ראשונית (Setup)

ראו את [`supabase/README.md`](supabase/README.md) לצעדי ההקמה המלאים של Supabase
(הקבצים `supabase/migrations/0001_init.sql`, `0002_storage_policies.sql`, `0003_delete_policies.sql`, ו-`seed.sql`).

בקצרה:

1. צרו פרויקט חדש ב-https://supabase.com/dashboard.
2. הריצו את שני קבצי ה-migration ואת ה-seed ב-SQL Editor.
3. צרו את ה-bucket `request-files` (לא ציבורי) ב-Storage והריצו את policies הסטוראג' והמחיקה.
4. צרו משתמשי דמו ב-Authentication → Users (Auto Confirm).
5. העתיקו את `.env.example` ל-`.env.local`, מלאו `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`.
6. הריצו את האפליקציה:

   ```bash
   npm install
   npm run dev
   ```
   פתחו http://localhost:5173 והתחברו עם משתמש הדמו.

---

## תהליך משתמש

1. **התחברות** — `/`
2. **לוח בקרה** — שלום + רשימת פניות קודמות + כפתור "צור פנייה חדשה"
3. **פנייה חדשה** — מחלקה / תיאור / ספק / סכום / קבצים → "נתח פנייה"
4. **סיכום ראשוני** — ההמלצה, נימוק, תובנות מהמלל החופשי, ופעולות הבאות
5. **(אם צריך) השלמת פרטים משפטיים** — 3 כרטיסים, אפשר חלקי
6. **אישור שליחה** — סיכום מלא → "שלח לבדיקה משפטית" → מסך אישור (לא נשלח מייל בפועל)

---

## חוקי הסיווג

מוגדרים ב-`src/lib/classifier.ts`. סדר עדיפויות:

1. `missing_info` — תיאור קצר/חסר.
2. `legal_review` — מילות מפתח משפטיות, או סכום ≥ 200,000 ₪.
3. `insurance_required` — ODT, הסעות, כיבוד, לינה.
4. `general_terms` — ברירת מחדל.

פתיחת ספק חדש אינה מסלול סיווג. אם המשתמש לא מוצא ספק במאגר, הוא לוחץ על הקישור ליד שדה הספק ופותח את טופס מאגר ספקים 2026.

עריכת מילות מפתח: ערכו את המערכים `LEGAL_KEYWORDS`, `SUPPLIER_REG_KEYWORDS`, `INSURANCE_TAG_RULES`.

---

## POC test scenarios

קובץ תרחישי בדיקה ידנית, בעברית RTL, עם הקלט המדויק לכל תרחיש והסיווג הצפוי:
[`docs/rashi-poc-test-scenarios.md`](docs/rashi-poc-test-scenarios.md)

מכסה את ארבעת מסלולי הסיווג הפעילים (`general_terms`, `insurance_required`, `legal_review`, `missing_info`), כולל תרחישי `legal_review` עם prefill אוטומטי של טופס ה-intake המשפטי וגם תרחיש שמדגים את סדר העדיפויות (legal_review > insurance_required). פתיחת ספק חדש נבדקת כפעולה נפרדת דרך הקישור ליד שדה הספק.

## מגבלות POC

- **אין ניתוח תוכן קבצים** — קבצים נשמרים אך לא נקראים.
- **אין מייל** — שליחה לבדיקה משפטית רק מסמנת status.
- **אין הרשמה עצמית** — משתמשים נוצרים ידנית.
- **אין פאנל אדמין** — בעלי תפקידים יראו רק את הפניות שלהם (RLS).
