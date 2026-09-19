# حزمة التحديث — مزامنة نتيجة SVF + ميزتين جديدتين

> مبنية على النسخة التي أرسلتها الآن (`Donation-management-system-WEB-App-finalversion`).
> الملفات هنا هي **الجديدة والمعدّلة فقط**. انسخها فوق المشروع مع الحفاظ على مساراتها.

---

## 1. ما لم أمسّه إطلاقًا

| الملف | الحالة |
| --- | --- |
| `prisma/schema.prisma` | **لم يُمسّ** — لا حاجة لـ migration |
| `src/lib/svf.js` (`computeSVF`) | **لم يُمسّ** — المعادلة كما هي |
| `src/lib/waterFilling.js` | **لم يُمسّ** — خوارزمية التوزيع كما هي |
| مسارات API وأسماء الحقول | لم يُحذف ولم يُعد تسمية أي شيء |

كل ما حدث: **إضافة استدعاءات إعادة الحساب في الأماكن التي كانت ناقصة** + حراسة أنواع المدخلات + واجهتين جديدتين.

### مؤجّل بطلبك (لم ألمسه)

1. الأرملة بلا معيل: 15 نقطة مقابل 20 (حصرية الحالة الاجتماعية).
2. رب أسرة عمره 25 سنة بالضبط (`<` مقابل `<=`).

الاثنان داخل `svf.js` ولم يُلمسا — نناقشهما لاحقًا.

---

## 2. تصحيح لبلاغ سابق: `commune` ليس خطأ

في تقرير الجولة الماضية ظهر «`commune` غير قابل للتعديل في العائلة». **هذا إنذار كاذب**:

```
prisma/schema.prisma:199   commune  String        <- داخل model Mosque
prisma/schema.prisma:222   @@index([wilaya, commune])
```

نموذج `Family` (الأسطر 281–326) **لا يحتوي عمود `commune` أصلًا**. إضافته إلى `editable` كانت ستجعل Prisma يرمي خطأ. لذلك تركته كما هو.

---

## 3. مشاكل المزامنة التي أُصلِحت

### الخلل الرئيسي (أخطر ما وجدت)

أربعة مسارات تُعطي مالًا للعائلات **ولا تُعيد حساب أي نتيجة SVF إطلاقًا**. النتيجة: عائلة أخذت مساعدة تبقى بنفس الأولوية وتأخذ مرة أخرى في التوزيع التالي.

| المسار | قبل | بعد |
| --- | --- | --- |
| `POST /api/distribution/confirm` | لا يُعيد الحساب | `recalcFamilies()` لكل المستفيدين دفعة واحدة |
| `PUT /api/distributions/:id` (سطر PAID/CANCELLED) | لا يُعيد | يُعيد حساب العائلة المعنية |
| `PUT /api/distributions/:id` (إلغاء كل التوزيع) | يترك السطور PENDING | يحوّل كل PENDING → CANCELLED ثم يُعيد الحساب |
| `DELETE /api/distributions/:id` | لا يُعيد | يلتقط العائلات **قبل** الحذف ثم يُعيد الحساب |
| `POST /api/distributions` (مساعدة يدوية) | لا يُعيد ، والسطر يبقى PENDING رغم خصم الرصيد | يُعيد الحساب ، والسطر `PAID` + `paidAt` |

### مزامنة رب الأسرة ↔ بطاقة العائلة (جديد)

كان الاسم وتاريخ الميلاد والإعاقة مخزّنة **مرتين**: في `Family` وفي `FamilyMember(HEAD)`، ولا شيء يربطهما. تعديل أحدهما كان يترك الآخر قديمًا، ومعادلة SVF تقرأ من `Family` → نتيجة محسوبة على بيانات مُتقادمة.

الآن `src/lib/familySync.js` يعكس الحقول الخمسة في الاتجاهين:

```
firstName · lastName · dateOfBirth · hasDisability · diseases
```

والمزامنة تجري **قبل** إعادة الحساب، لا بعدها.

### حراسة المدخلات (17 خطأ HTTP 500 اختفى)

إرسال رقم أكبر من حد `Int32` إلى `/api/settings` كان يُسقط الخادم (500). الآن `src/lib/validate.js` يحرس كل المدخلات ويردّ 400 مفهومًا:

- أعمار (`seniorAgeThreshold`, `youngHeadAgeThreshold`) ≤ 130
- نقاط ≤ 100000
- `svfWeightExponent` ≤ 10
- مبالغ ≤ Int32

### إصلاحات أخرى

- البحث في `/api/families` يشمل الآن `ccp`.
- `PUT /api/members/:id` لم يعد يقبل اسمًا فارغًا.
- `POST /api/auth/register` يردّ 201 ويتحقق من حقول المسجد.
- `donorType` يُحرس بقائمة مغلقة.
- عند إنشاء عائلة مع رب أسرة في نفس الطلب، بطاقة العائلة تتبع بيانات الرب.

---

## 4. الميزتان الجديدتان

### أ) نقر مستطيل الفرد ← نافذة وصف

`src/components/forms/MemberDetailModal.jsx` (جديد).
تعرض: الصفة · تاريخ الميلاد · العمر · الحالة الصحية · المهنة · الدخل · تاريخ التسجيل · آخر تعديل · الأمراض المصرّح بها.
إذا كان الفرد رب الأسرة، يظهر تنبيه: معلوماته تدخل في نتيجة SVF.

### ب) تعديل أي فرد — بما فيهم رب الأسرة

- زر تعديل مباشر على كل مستطيل + زر داخل نافذة الوصف.
- `MemberFormModal` أصبح يعمل في وضعين: إضافة / تعديل.
- عند تعديل رب الأسرة: الصفة مقفولة (409 من الخادم إذا حاول أحد تجاوز الواجهة)، والحقول الخمسة تُنقل إلى بطاقة العائلة وتُعاد النتيجة فورًا (تظهر في رسالة toast).
- حذف فرد يمر بنافذة تأكيد، ورب الأسرة غير قابل للحذف منفردًا.

### ج) الرصيد الحالي في حاوية مستقلة

`src/components/BalanceCard.jsx` (جديد) — معروض في **لوحة التحكم** وفي **صفحة التبرعات** بنفس الشكل ونفس الرقم.

- رقم بحجم 34px مع شريط لوني جانبي.
- أخضر = عادي · أصفر = أقل من 10 000 د.ج · أحمر = رصيد سالب.
- إلى جانبه: إجمالي الدخول وإجمالي الخروج + زر إجراء.
- صفحة التبرعات أصبحت تقرأ `/dashboard/stats` لأن الرصيد ليس مجموع التبرعات — التوزيعات تخصم منه.

---

## 5. المدخلات السبعة لمعادلة SVF (طلب `final check.txt`)

| # | المدخل | المصدر | إجباري؟ | إذا كان `null` |
| --- | --- | --- | --- | --- |
| 1 | الدخل الشهري | `Family.monthlyIncome` | لا | `0` ← يعطي أعلى نقاط |
| 2 | عدد الأطفال | `childrenCount` ← `childrenSchoolCount` | لا | `0` |
| 3 | الحالة الاجتماعية | `maritalStatus` + `incomeSources` | **نعم** | مرفوض عند الإنشاء |
| 4 | الحالة الصحية | `hasDisability` + `diseases` | لا | `false` / `""` |
| 5 | السكن | `housingStatus` | **نعم** | مرفوض |
| 6 | عدد المساعدات السابقة | `DistributionItem` (PENDING + PAID) | محسوب | يُحسب لحظيًا |
| 7 | عمر رب الأسرة | `Family.dateOfBirth` | **نعم** | مرفوض |

**ملاحظة مهمة:** المدخل رقم 6 يعدّ `PENDING` و`PAID` ويستثني `CANCELLED`. أي: العائلة تُعاقب بمجرّد إقرار المساعدة لا عند دفعها — حتى لا تدخل توزيعًا ثانيًا قبل أن تقبض الأول. لتغيير هذا القرار، غيّر سطرًا واحدًا في `src/lib/aidHistory.js`:

```js
export const AID_COUNTED_STATUSES = ["PENDING", "PAID"];  // ← ["PAID"] لو أردت
```

ولأن المدخلات 1، 2، 4 تقبل `null`، فإن عائلة ناقصة البيانات **تُحسب مع ذلك**، وتميل إلى نتيجة أعلى (دخل صفر). لذلك نافذة العائلة تعرض تحذير «بطاقة غير مكتملة».

---

## 6. الملفات (24 ملفًا)

### جديدة (5)

```
src/lib/aidHistory.js
src/lib/validate.js
src/components/BalanceCard.jsx
src/components/forms/MemberDetailModal.jsx
test-sync-suite.mjs
```

### معدّلة (18)

```
src/lib/familySync.js
src/lib/recalc.js
src/lib/familyMembers.js
src/lib/i18n.js
src/app/globals.css
src/app/(app)/dashboard/page.js
src/app/(app)/dons/page.js
src/components/forms/MemberFormModal.jsx
src/components/forms/FamilyDetailModal.jsx
src/app/api/families/route.js
src/app/api/families/[id]/route.js
src/app/api/families/[id]/members/route.js
src/app/api/members/[memberId]/route.js
src/app/api/distribution/confirm/route.js
src/app/api/distributions/route.js
src/app/api/distributions/[id]/route.js
src/app/api/settings/route.js
src/app/api/donors/route.js
src/app/api/auth/register/route.js
```

---

## 7. التركيب

```powershell
cd "C:\Users\USER\Desktop\Donation-management-system-WEB-App-main"
Expand-Archive -Path "$env:USERPROFILE\Downloads\charity-sync-v3.zip" -DestinationPath . -Force
npm run dev
```

لا حاجة لـ `npx prisma migrate` — لا تغيير في قاعدة البيانات.

---

## 8. تشغيل اختبارات المزامنة

```powershell
# في نافذة أولى
npm run dev

# في نافذة ثانية
node test-sync-suite.mjs --password "imam1111" --mosque cmsexl13m0001cgeytn0mer03
```

خيارات: `--only T9,T11` · `--skip T14` · `--verbose` · `--keep` · `--list`

الناتج: `sync-report.json` + `sync-report.md`

### ماذا تختبر الـ 16 اختبارًا

| # | الاختبار |
| --- | --- |
| T1 | النتيجة والأولوية موجودتان منذ الإنشاء، ومطابقتان لما في قاعدة البيانات |
| T2 | إضافة زوج → `MARRIED` + ارتفاع العدد + إعادة حساب |
| T3 | تعديل رب الأسرة → ميرر + إعادة حساب + رفض تغيير الصفة والحذف |
| T4 | تعديل العائلة → الرب يتبع (الاتجاه المعاكس) |
| T5 | حذف فرد → العدد والنتيجة |
| T6 | إضافة/حذف طفل → النتيجة ترجع للقيمة الأصلية بالضبط |
| T7 | مساعدة يدوية → النتيجة تنزل ، السطر PAID ، الرصيد يُخصم |
| T8 | مساعدات متتالية → تراكم ثم سقف |
| T9 | تأكيد توزيع → **كل** المستفيدين + `svfSnapshot` يحفظ ما قبل |
| T10 | تأكيد دفع → الرصيد يُخصم ، ولا مالوس مزدوج |
| T11 | إلغاء سطر → النتيجة ترجع بالضبط |
| T12 | إلغاء توزيع كامل → لا يبقى PENDING ، كل النتائج تُسترجع |
| T13 | حذف توزيع → الرصيد والنتيجة يُسترجعان |
| T14 | تغيير بارم الإعدادات → كل العائلات + رجوع دقيق + رفض القيم الشاذة دون 500 |
| T15 | عائلة مؤرشفة → خارج التوزيع ، محفوظة ، قابلة للتفعيل |
| T16 | سيناريو كامل من الإنشاء إلى الإلغاء مع تتبّع كل خطوة |

الاختبار يُنشئ بياناته ببادئة `ZZSYNC` ثم يحذفها ويعيد الإعدادات إلى أصلها. لا يمسّ بياناتك الحقيقية.

إن كان `autoCalculateSVF = false` في الإعدادات، ستفشل اختبارات المزامنة — والسكربت ينبّهك لذلك عند البدء.
