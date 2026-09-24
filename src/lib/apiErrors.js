// Translates the plain-English error strings returned by the API's fail()
// helper (src/lib/apiResponse.js) into French or Arabic before they reach a
// toast/UI. The API routes stay in English internally (server logs, easier
// to grep in tests) -- only the string shown to the imam is localized here.
//
// Two layers:
//   1. EXACT_MESSAGES: a straight lookup for the fixed strings used across
//      src/app/api/**.
//   2. PATTERN_RULES: regex rules for the templated messages built by
//      src/lib/validate.js (numberField/dateField/enumField/requiredText) and
//      a handful of inline `Invalid ${x}: ${y}` checks, where a field name or
//      a value is interpolated at runtime.
//
// FIELD_NAMES maps the internal (English, camelCase) field identifiers used
// in those templates to a human label in each language, so "monthlyIncome is
// required." becomes "Le revenu mensuel est requis." / ".الدخل الشهري مطلوب"
// Unknown field names fall back to the raw identifier rather than crashing.

const FIELD_NAMES = {
  fr: {
    "Donor name": "Le nom du donateur",
    amount: "Le montant",
    dateOfBirth: "La date de naissance",
    donorType: "Le type de donateur",
    firstName: "Le prénom",
    lastName: "Le nom",
    membersCount: "Le nombre de membres",
    monthlyIncome: "Le revenu mensuel",
    rentAmount: "Le montant du loyer",
    diseases: "Les maladies",
    occupation: "La profession",
    budget: "Le budget",
    familyId: "L'identifiant de la famille",
    category: "La catégorie",
    role: "Le rôle",
    status: "Le statut",
    maritalStatus: "La situation familiale",
    paymentMethod: "Le mode de paiement",
    paymentStatus: "Le statut de paiement",
    phone: "Le téléphone",
    email: "L'e-mail",
    notes: "Les notes",
    paymentType: "Le type de paiement",
    paymentFrequency: "La fréquence de paiement",
    usualAmount: "Le montant habituel",
    svfMaxScore: "Le score SVF maximum",
    pointsIfIncomeBelowSMIG: "Les points (revenu sous le SMIG)",
    pointsIfIncomeBelow2xSMIG: "Les points (revenu sous 2x le SMIG)",
    pointsIfIncomeBelow3xSMIG: "Les points (revenu sous 3x le SMIG)",
    pointsPerChild: "Les points par enfant",
    childPointsCap: "Le plafond de points enfants",
    pointsIfWidowedDivorced: "Les points (veuf/divorcé)",
    pointsIfNoSupport: "Les points (sans soutien)",
    pointsIfDisability: "Les points (handicap)",
    pointsIfChronicIllness: "Les points (maladie chronique)",
    pointsIfTenant: "Les points (locataire)",
    malusPerAidReceived: "Le malus par aide reçue",
    malusCap: "Le plafond du malus",
    seniorAgeThreshold: "Le seuil d'âge senior",
    pointsIfSeniorHead: "Les points (chef de famille senior)",
    youngHeadAgeThreshold: "Le seuil d'âge jeune",
    pointsIfYoungHead: "Les points (chef de famille jeune)",
    smigThreshold: "Le seuil SMIG",
    povertyThresholdPerPerson: "Le seuil de pauvreté par personne",
    svfWeightExponent: "L'exposant de pondération SVF",
    minimumDistributionAmount: "Le montant minimum de distribution",
    reservePercentage: "Le pourcentage de réserve",
  },
  ar: {
    "Donor name": "اسم المتبرع",
    amount: "المبلغ",
    dateOfBirth: "تاريخ الميلاد",
    donorType: "نوع المتبرع",
    firstName: "الاسم",
    lastName: "اللقب",
    membersCount: "عدد الأفراد",
    monthlyIncome: "الدخل الشهري",
    rentAmount: "مبلغ الإيجار",
    diseases: "الأمراض",
    occupation: "المهنة",
    budget: "الميزانية",
    familyId: "معرّف العائلة",
    category: "الفئة",
    role: "الصفة",
    status: "الحالة",
    maritalStatus: "الحالة العائلية",
    paymentMethod: "طريقة الدفع",
    paymentStatus: "حالة الدفع",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    notes: "ملاحظات",
    paymentType: "نوع الدفع",
    paymentFrequency: "وتيرة الدفع",
    usualAmount: "المبلغ المعتاد",
    svfMaxScore: "أقصى نتيجة SVF",
    pointsIfIncomeBelowSMIG: "النقاط (دخل أقل من الحد الأدنى للأجور)",
    pointsIfIncomeBelow2xSMIG: "النقاط (دخل أقل من ضعف الحد الأدنى للأجور)",
    pointsIfIncomeBelow3xSMIG: "النقاط (دخل أقل من 3 أضعاف الحد الأدنى للأجور)",
    pointsPerChild: "النقاط لكل طفل",
    childPointsCap: "الحد الأقصى لنقاط الأطفال",
    pointsIfWidowedDivorced: "النقاط (أرمل/مطلّق)",
    pointsIfNoSupport: "النقاط (بدون معيل)",
    pointsIfDisability: "النقاط (إعاقة)",
    pointsIfChronicIllness: "النقاط (مرض مزمن)",
    pointsIfTenant: "النقاط (مستأجر)",
    malusPerAidReceived: "الخصم لكل مساعدة مستلمة",
    malusCap: "الحد الأقصى للخصم",
    seniorAgeThreshold: "حد سن كبار السن",
    pointsIfSeniorHead: "النقاط (رب أسرة مسن)",
    youngHeadAgeThreshold: "حد السن الشاب",
    pointsIfYoungHead: "النقاط (رب أسرة شاب)",
    smigThreshold: "حد الأجر الأدنى",
    povertyThresholdPerPerson: "حد الفقر لكل شخص",
    svfWeightExponent: "أُس ترجيح SVF",
    minimumDistributionAmount: "الحد الأدنى لمبلغ التوزيع",
    reservePercentage: "نسبة الاحتياطي",
  },
};

// Human labels for enum-ish values that show up inside "Invalid X: Y" errors.
const VALUE_NAMES = {
  fr: {
    ZAKAT_MAL: "Zakat al-Mal",
    SADAQAH: "Sadaqah",
    CASH: "Espèces",
    CCP: "CCP",
    BANK_TRANSFER: "Virement bancaire",
    HEAD: "Chef de famille",
    SPOUSE: "Conjoint(e)",
    CHILD: "Enfant",
    OTHER: "Autre",
    SINGLE: "Célibataire",
    MARRIED: "Marié(e)",
    WIDOWED: "Veuf/Veuve",
    DIVORCED: "Divorcé(e)",
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    ARCHIVED: "Archivé",
    PAID: "Payé",
    CANCELLED: "Annulé",
    PENDING: "En attente",
    INDIVIDUAL: "Individuel",
    ORGANIZATION: "Organisation",
    UNEMPLOYED: "Sans emploi",
    PART_TIME: "Temps partiel",
    FULL_TIME: "Temps plein",
    RETIRED: "Retraité",
    DISABLED: "Handicapé",
    NONE: "Aucun",
    IMAM: "Imam",
    MUEZZIN: "Muezzin",
    MAINTENANCE_STAFF: "Agent d'entretien",
    ARTISAN: "Artisan",
    SUPPLIER: "Fournisseur",
    REGULAR: "Régulier",
    OCCASIONAL: "Occasionnel",
    WEEKLY: "Hebdomadaire",
    MONTHLY: "Mensuel",
    CHEQUE: "Chèque",
  },
  ar: {
    ZAKAT_MAL: "زكاة المال",
    SADAQAH: "صدقة",
    CASH: "نقدًا",
    CCP: "الحساب البريدي الجاري",
    BANK_TRANSFER: "تحويل بنكي",
    HEAD: "رب الأسرة",
    SPOUSE: "الزوج/الزوجة",
    CHILD: "طفل",
    OTHER: "آخر",
    SINGLE: "أعزب",
    MARRIED: "متزوج",
    WIDOWED: "أرمل",
    DIVORCED: "مطلّق",
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    ARCHIVED: "مؤرشف",
    PAID: "مدفوع",
    CANCELLED: "ملغى",
    PENDING: "قيد الانتظار",
    INDIVIDUAL: "فردي",
    ORGANIZATION: "منظمة",
    UNEMPLOYED: "بدون عمل",
    PART_TIME: "دوام جزئي",
    FULL_TIME: "دوام كامل",
    RETIRED: "متقاعد",
    DISABLED: "معاق",
    NONE: "لا شيء",
    IMAM: "إمام",
    MUEZZIN: "مؤذن",
    MAINTENANCE_STAFF: "عامل صيانة",
    ARTISAN: "حرفي",
    SUPPLIER: "مورّد",
    REGULAR: "منتظم",
    OCCASIONAL: "مناسباتي",
    WEEKLY: "أسبوعي",
    MONTHLY: "شهري",
    CHEQUE: "شيك",
  },
};

function fieldLabel(locale, name) {
  return FIELD_NAMES[locale]?.[name] || name;
}
function valueLabel(locale, value) {
  return VALUE_NAMES[locale]?.[value] || value;
}

// Straight 1:1 translations for the fixed strings passed to fail(...) across
// src/app/api/**. Keep this alphabetized by English source for easy diffing
// against a fresh `grep -rhoP 'fail\(\s*"[^"]*"'` over src/app/api.
const EXACT_MESSAGES = {
  "A family can only have one head.": {
    fr: "Une famille ne peut avoir qu'un seul chef de famille.",
    ar: "لا يمكن أن يكون للعائلة أكثر من رب أسرة واحد.",
  },
  "A family with this CCP already exists.": {
    fr: "Une famille avec ce numéro CCP existe déjà.",
    ar: "توجد بالفعل عائلة بهذا الحساب البريدي الجاري (CCP).",
  },
  "A mosque is already registered with this email.": {
    fr: "Une mosquée est déjà enregistrée avec cet e-mail.",
    ar: "يوجد مسجد مسجل بالفعل بهذا البريد الإلكتروني.",
  },
  "A mosque with these details already exists.": {
    fr: "Une mosquée avec ces informations existe déjà.",
    ar: "يوجد مسجد بهذه المعلومات بالفعل.",
  },
  "A positive 'budget' is required.": {
    fr: "Un budget positif est requis.",
    ar: "الميزانية مطلوبة ويجب أن تكون موجبة.",
  },
  "A positive amount is required.": {
    fr: "Un montant positif est requis.",
    ar: "المبلغ مطلوب ويجب أن يكون موجبًا.",
  },
  "Administrator access required.": {
    fr: "Accès administrateur requis.",
    ar: "الوصول مخصص للمسؤول فقط.",
  },
  "An unexpected error occurred during registration.": {
    fr: "Une erreur inattendue est survenue lors de l'inscription.",
    ar: "حدث خطأ غير متوقع أثناء التسجيل.",
  },
  "An unexpected error occurred. Please try again.": {
    fr: "Une erreur inattendue est survenue. Veuillez réessayer.",
    ar: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
  },
  "Beneficiary not found.": {
    fr: "Bénéficiaire introuvable.",
    ar: "المستفيد غير موجود.",
  },
  "Child not found.": {
    fr: "Enfant introuvable.",
    ar: "الطفل غير موجود.",
  },
  "Current password is incorrect.": {
    fr: "Le mot de passe actuel est incorrect.",
    ar: "كلمة المرور الحالية غير صحيحة.",
  },
  "Distribution item not found.": {
    fr: "Ligne de distribution introuvable.",
    ar: "عنصر التوزيع غير موجود.",
  },
  "Distribution not found.": {
    fr: "Distribution introuvable.",
    ar: "التوزيع غير موجود.",
  },
  "Document not found.": {
    fr: "Document introuvable.",
    ar: "المستند غير موجود.",
  },
  "Donation not found.": {
    fr: "Don introuvable.",
    ar: "التبرع غير موجود.",
  },
  "Donor name is required.": {
    fr: "Le nom du donateur est requis.",
    ar: "اسم المتبرع مطلوب.",
  },
  "Donor not found. The donor must exist in the database.": {
    fr: "Donateur introuvable. Le donateur doit exister dans la base de données.",
    ar: "المتبرع غير موجود. يجب أن يكون المتبرع مسجلاً في قاعدة البيانات.",
  },
  "Donor not found.": {
    fr: "Donateur introuvable.",
    ar: "المتبرع غير موجود.",
  },
  "Email already in use.": {
    fr: "Cet e-mail est déjà utilisé.",
    ar: "هذا البريد الإلكتروني مستخدم بالفعل.",
  },
  "Family not found.": {
    fr: "Famille introuvable.",
    ar: "العائلة غير موجودة.",
  },
  "Invalid credentials.": {
    fr: "Identifiants invalides.",
    ar: "بيانات الدخول غير صحيحة.",
  },
  "Invalid mosque email.": {
    fr: "E-mail de la mosquée invalide.",
    ar: "البريد الإلكتروني للمسجد غير صالح.",
  },
  "Invalid paymentStatus.": {
    fr: "Statut de paiement invalide.",
    ar: "حالة الدفع غير صالحة.",
  },
  "Member not found.": {
    fr: "Membre introuvable.",
    ar: "الفرد غير موجود.",
  },
  "Missing required registration fields.": {
    fr: "Des champs obligatoires sont manquants pour l'inscription.",
    ar: "بعض الحقول المطلوبة للتسجيل مفقودة.",
  },
  "Mosque and password are required.": {
    fr: "La mosquée et le mot de passe sont requis.",
    ar: "المسجد وكلمة المرور مطلوبان.",
  },
  "Mosque name cannot be empty.": {
    fr: "Le nom de la mosquée ne peut pas être vide.",
    ar: "لا يمكن أن يكون اسم المسجد فارغًا.",
  },
  "Mosque not found.": {
    fr: "Mosquée introuvable.",
    ar: "المسجد غير موجود.",
  },
  "Payment not found.": {
    fr: "Paiement introuvable.",
    ar: "الدفعة غير موجودة.",
  },
  "New password must be at least 8 characters.": {
    fr: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
    ar: "يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.",
  },
  "No mosque is linked to this account.": {
    fr: "Aucune mosquée n'est liée à ce compte.",
    ar: "لا يوجد مسجد مرتبط بهذا الحساب.",
  },
  "No recognised settings field was provided.": {
    fr: "Aucun champ de paramètres reconnu n'a été fourni.",
    ar: "لم يتم تقديم أي حقل إعدادات معروف.",
  },
  "No updatable field was provided.": {
    fr: "Aucun champ modifiable n'a été fourni.",
    ar: "لم يتم تقديم أي حقل قابل للتعديل.",
  },
  "Password must be at least 8 characters long.": {
    fr: "Le mot de passe doit contenir au moins 8 caractères.",
    ar: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
  },
  "Please enter a valid email address.": {
    fr: "Veuillez saisir une adresse e-mail valide.",
    ar: "يرجى إدخال بريد إلكتروني صالح.",
  },
  "Please enter a valid mosque email address.": {
    fr: "Veuillez saisir une adresse e-mail valide pour la mosquée.",
    ar: "يرجى إدخال بريد إلكتروني صالح للمسجد.",
  },
  "This account is not active yet.": {
    fr: "Ce compte n'est pas encore actif.",
    ar: "هذا الحساب غير نشط بعد.",
  },
  "This email is already used by another mosque.": {
    fr: "Cet e-mail est déjà utilisé par une autre mosquée.",
    ar: "هذا البريد الإلكتروني مستخدم بالفعل من طرف مسجد آخر.",
  },
  "This family already has a head of family.": {
    fr: "Cette famille a déjà un chef de famille.",
    ar: "هذه العائلة لديها بالفعل رب أسرة.",
  },
  "This item's status can no longer be changed.": {
    fr: "Le statut de cette ligne ne peut plus être modifié.",
    ar: "لم يعد بالإمكان تغيير حالة هذا العنصر.",
  },
  "Unable to load mosque options.": {
    fr: "Impossible de charger la liste des mosquées.",
    ar: "تعذر تحميل قائمة المساجد.",
  },
  "category is required (e.g. ZAKAT_MAL, SADAQAH).": {
    fr: "La catégorie est requise (ex. ZAKAT_MAL, SADAQAH).",
    ar: "الفئة مطلوبة (مثال: ZAKAT_MAL أو SADAQAH).",
  },
  "contentBase64 is required.": {
    fr: "Le contenu du fichier (contentBase64) est requis.",
    ar: "محتوى الملف مطلوب.",
  },
  "currentPassword is required to change the password.": {
    fr: "Le mot de passe actuel est requis pour changer de mot de passe.",
    ar: "كلمة المرور الحالية مطلوبة لتغيير كلمة المرور.",
  },
  "customCriteria must be an array.": {
    fr: "customCriteria doit être une liste.",
    ar: "يجب أن تكون المعايير المخصصة قائمة.",
  },
  "diseases must be a text value.": {
    fr: "Les maladies doivent être une valeur textuelle.",
    ar: "يجب أن تكون الأمراض قيمة نصية.",
  },
  "familyId is required.": {
    fr: "L'identifiant de la famille est requis.",
    ar: "معرّف العائلة مطلوب.",
  },
  "incomeSources must be an array.": {
    fr: "Les sources de revenus doivent être une liste.",
    ar: "يجب أن تكون مصادر الدخل قائمة.",
  },
  "mosque must be an object.": {
    fr: "Les informations de la mosquée sont invalides.",
    ar: "معلومات المسجد غير صالحة.",
  },
  "originalName is required.": {
    fr: "Le nom du fichier est requis.",
    ar: "اسم الملف الأصلي مطلوب.",
  },
  "paymentMethod is required (CASH, CCP, BANK_TRANSFER).": {
    fr: "Le mode de paiement est requis (Espèces, CCP, Virement bancaire).",
    ar: "طريقة الدفع مطلوبة (نقدًا، حساب بريدي جاري، تحويل بنكي).",
  },
  "receivedAt is not a valid date.": {
    fr: "La date de réception n'est pas valide.",
    ar: "تاريخ الاستلام غير صالح.",
  },
  "reservePercentage cannot exceed 100.": {
    fr: "Le pourcentage de réserve ne peut pas dépasser 100.",
    ar: "لا يمكن أن تتجاوز نسبة الاحتياطي 100.",
  },
  "reservePercentage must be below 100%.": {
    fr: "Le pourcentage de réserve doit être inférieur à 100 %.",
    ar: "يجب أن تكون نسبة الاحتياطي أقل من 100٪.",
  },
  "svfWeightExponent cannot exceed 10.": {
    fr: "L'exposant de pondération SVF ne peut pas dépasser 10.",
    ar: "لا يمكن أن يتجاوز أُس ترجيح SVF القيمة 10.",
  },
  "svfWeights must be an object or null.": {
    fr: "Les pondérations SVF doivent être un objet ou nulles.",
    ar: "يجب أن تكون أوزان SVF كائنًا أو فارغة.",
  },
  "Authentication required.": {
    fr: "Authentification requise.",
    ar: "المصادقة مطلوبة.",
  },
  "Invalid or expired session.": {
    fr: "Session invalide ou expirée.",
    ar: "الجلسة غير صالحة أو منتهية الصلاحية.",
  },
  "User no longer exists.": {
    fr: "Cet utilisateur n'existe plus.",
    ar: "لم يعد هذا المستخدم موجودًا.",
  },
  "Session has been logged out on this device.": {
    fr: "La session a été déconnectée sur cet appareil.",
    ar: "تم تسجيل الخروج من هذه الجلسة على هذا الجهاز.",
  },
  "No families to distribute to.": {
    fr: "Aucune famille à qui distribuer.",
    ar: "لا توجد عائلات لتوزيع المساعدات عليها.",
  },
  "Budget must be greater than 0.": {
    fr: "Le budget doit être supérieur à 0.",
    ar: "يجب أن تكون الميزانية أكبر من 0.",
  },
  "Total SVF score is zero; cannot allocate proportionally. Recalculate the family scores first.": {
    fr: "Le score SVF total est nul ; répartition proportionnelle impossible. Recalculez d'abord les scores des familles.",
    ar: "مجموع نقاط SVF يساوي صفرًا؛ يتعذر التوزيع النسبي. أعد حساب نقاط العائلات أولاً.",
  },
  "Invalid or missing JSON body.": {
    fr: "Le contenu de la requête est invalide ou manquant.",
    ar: "محتوى الطلب غير صالح أو مفقود.",
  },
  "Missing required fields.": {
    fr: "Des champs obligatoires sont manquants.",
    ar: "بعض الحقول المطلوبة مفقودة.",
  },
};

// Regex rules for templated messages. Each `translate(m)` receives the regex
// match and returns the localized string, or null to let the next rule (or
// the original message) take over.
const PATTERN_RULES = [
  // waterFilling.js -- distribution simulation guards (shown on the
  // Distributions page, e.g. "Budget too low for the number of families...")
  {
    re: /^The maximum per family \(([\d.]+)\) is lower than the minimum \(([\d.]+)\)\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الحد الأقصى لكل عائلة (${m[1]}) أقل من الحد الأدنى (${m[2]}).`
        : `Le maximum par famille (${m[1]}) est inférieur au minimum (${m[2]}).`,
  },
  {
    re: /^Budget too low for the number of families\. Minimum required \(net\): ([\d,]+)\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الميزانية غير كافية لعدد العائلات. الحد الأدنى المطلوب (صافي): ${m[1]}.`
        : `Budget insuffisant pour le nombre de familles. Minimum requis (net) : ${m[1]}.`,
  },
  {
    re: /^Budget too low: paying (\S+) to each of the (\d+) families requires ([\d,]+) net\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الميزانية غير كافية: دفع ${m[1]} لكل عائلة من العائلات الـ ${m[2]} يتطلب ${m[3]} صافي.`
        : `Budget insuffisant : verser ${m[1]} à chacune des ${m[2]} familles nécessite ${m[3]} net.`,
  },
  // validate.js: numberField / dateField / requiredText / enumField
  {
    re: /^(.+?) must be a number\.$/,
    translate: (m, locale) =>
      `${fieldLabel(locale, m[1])} ${
        locale === "ar" ? "يجب أن يكون رقمًا." : "doit être un nombre."
      }`,
  },
  {
    re: /^(.+?) is out of range\. Expected an integer between (-?\d+) and (-?\d+)\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} خارج النطاق المسموح (يجب أن يكون بين ${m[2]} و ${m[3]}).`
        : `${fieldLabel(locale, m[1])} est hors limites (doit être compris entre ${m[2]} et ${m[3]}).`,
  },
  {
    re: /^(.+?) cannot be lower than (-?[\d.]+)\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} لا يمكن أن يكون أقل من ${m[2]}.`
        : `${fieldLabel(locale, m[1])} ne peut pas être inférieur à ${m[2]}.`,
  },
  {
    re: /^(.+?) cannot be greater than (-?[\d.]+)\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} لا يمكن أن يكون أكبر من ${m[2]}.`
        : `${fieldLabel(locale, m[1])} ne peut pas être supérieur à ${m[2]}.`,
  },
  {
    re: /^(.+?) is too large\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} كبير جدًا.`
        : `${fieldLabel(locale, m[1])} est trop élevé.`,
  },
  {
    re: /^(.+?) is required\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} مطلوب.`
        : `${fieldLabel(locale, m[1])} est requis.`,
  },
  {
    re: /^(.+?) is not a valid date\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} ليس تاريخًا صالحًا.`
        : `${fieldLabel(locale, m[1])} n'est pas une date valide.`,
  },
  {
    re: /^(.+?) cannot be earlier than (\d+)\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} لا يمكن أن يكون قبل سنة ${m[2]}.`
        : `${fieldLabel(locale, m[1])} ne peut pas être antérieur à ${m[2]}.`,
  },
  {
    re: /^(.+?) cannot be in the future\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} لا يمكن أن يكون في المستقبل.`
        : `${fieldLabel(locale, m[1])} ne peut pas être dans le futur.`,
  },
  {
    re: /^(.+?) must be a text value\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} يجب أن يكون نصًا.`
        : `${fieldLabel(locale, m[1])} doit être une valeur textuelle.`,
  },
  {
    re: /^(.+?) cannot be empty\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} لا يمكن أن يكون فارغًا.`
        : `${fieldLabel(locale, m[1])} ne peut pas être vide.`,
  },
  {
    re: /^(.+?) cannot exceed (\d+) characters\.$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} لا يمكن أن يتجاوز ${m[2]} حرفًا.`
        : `${fieldLabel(locale, m[1])} ne peut pas dépasser ${m[2]} caractères.`,
  },
  {
    re: /^(.+?) is out of range\. Expected an integer between .+\.$/,
    translate: null, // handled above, kept out of the generic catch-all order
  },
  // Missing / invalid field, e.g. `Missing required field: monthlyIncome`
  {
    re: /^Missing required field: (.+)$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `${fieldLabel(locale, m[1])} مطلوب.`
        : `${fieldLabel(locale, m[1])} est requis.`,
  },
  // `Invalid <field>: <value>` variants (marital status, category, role, ...)
  {
    re: /^Invalid marital status: (.+)$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الحالة العائلية غير صالحة: ${valueLabel(locale, m[1])}.`
        : `Situation familiale invalide : ${valueLabel(locale, m[1])}.`,
  },
  {
    re: /^Invalid category: (.+)$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الفئة غير صالحة: ${valueLabel(locale, m[1])}.`
        : `Catégorie invalide : ${valueLabel(locale, m[1])}.`,
  },
  {
    re: /^Invalid role: (.+)$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الصفة غير صالحة: ${valueLabel(locale, m[1])}.`
        : `Rôle invalide : ${valueLabel(locale, m[1])}.`,
  },
  {
    re: /^Invalid status: (.+)$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `الحالة غير صالحة: ${valueLabel(locale, m[1])}.`
        : `Statut invalide : ${valueLabel(locale, m[1])}.`,
  },
  {
    re: /^Invalid paymentMethod: (.+)$/,
    translate: (m, locale) =>
      locale === "ar"
        ? `طريقة الدفع غير صالحة: ${valueLabel(locale, m[1])}.`
        : `Mode de paiement invalide : ${valueLabel(locale, m[1])}.`,
  },
  {
    re: /^Invalid member: (.+)$/,
    // Recurse: the nested message is itself one of these patterns/exact strings.
    translate: (m, locale) => {
      const inner = translateApiError(m[1], locale);
      return locale === "ar" ? `فرد غير صالح: ${inner}` : `Membre invalide : ${inner}`;
    },
  },
  {
    re: /^Invalid (\w+): (.+?)\. Expected one of (.+)\.$/,
    translate: (m, locale) => {
      const [, field, value, allowedRaw] = m;
      const allowed = allowedRaw
        .split(", ")
        .map((v) => valueLabel(locale, v))
        .join(locale === "ar" ? "، " : ", ");
      return locale === "ar"
        ? `${fieldLabel(locale, field)} غير صالح: ${valueLabel(locale, value)}. القيم المسموحة: ${allowed}.`
        : `${fieldLabel(locale, field)} invalide : ${valueLabel(locale, value)}. Attendu parmi : ${allowed}.`;
    },
  },
];

/**
 * Translate a message returned by the API into the given locale ("fr"/"ar").
 * Falls back to the original (English) message when nothing matches, so a
 * message that hasn't been catalogued yet is still shown rather than hidden.
 */
export function translateApiError(message, locale) {
  if (!message || typeof message !== "string") return message;
  if (locale !== "fr" && locale !== "ar") return message;

  const exact = EXACT_MESSAGES[message];
  if (exact) return exact[locale] || message;

  for (const rule of PATTERN_RULES) {
    if (!rule.translate) continue;
    const m = message.match(rule.re);
    if (m) {
      const out = rule.translate(m, locale);
      if (out) return out;
    }
  }

  return message;
}