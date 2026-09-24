// Authenticated-app messages retained while their literal keys are migrated.
// They are loaded exclusively through next-intl in src/i18n/request.ts.
export const AR = {
  // Brand / sidebar
  MENU: "القائمة",
  "Tableau de bord": "لوحة التحكم",
  Familles: "العائلات",
  Dons: "التبرعات",
  Donateurs: "المتبرعون",
  Distributions: "التوزيعات",
  Paramètres: "الإعدادات",
  Administrateur: "مدير",
  Imam: "إمام",
  Utilisateur: "مستخدم",
  Déconnexion: "تسجيل الخروج",
  "Interface non incluse": "واجهة غير متوفرة",

  // Topbar
  "Rechercher familles, dons, donateurs…":
    "ابحث عن العائلات، التبرعات، المتبرعين…",
  "Rechercher une famille…": "ابحث عن عائلة…",
  "Mode sombre": "الوضع الداكن",
  "Mode clair": "الوضع الفاتح",
  Notifications: "الإشعارات",
  "Aucune notification": "لا توجد إشعارات.",
  "Changer de langue": "تغيير اللغة",
  "Basculer le mode clair/sombre": "تبديل الوضع الفاتح/الداكن",
  Accueil: "الرئيسية",

  // Dashboard
  "voici l'aperçu du jour": "إليك نظرة عامة على اليوم",
  "Bon retour": "مرحباً بعودتك",
  "Actions Rapides": "إجراءات سريعة",
  "Ajouter un don": "إضافة تبرع",
  "Ajouter une famille": "إضافة عائلة",
  "Ajouter un donateur": "إضافة متبرع",
  "Nouvelle distribution": "توزيع جديد",
  Entrées: "الإيرادات",
  Sorties: "المصروفات",
  "Familles aidées": "العائلات المستفيدة",
  "Donateurs actifs": "المتبرعون النشطون",
  Solde: "الرصيد",
  enfants: "أطفال",
  dons: "تبرعات",
  "Entrées / Sorties": "الإيرادات / المصروفات",
  "6 derniers mois (DA)": "آخر 6 أشهر (دج)",
  "Situation sociale": "الوضع الاجتماعي",
  Difficile: "صعبة",
  Aucun: "لا شيء",
  "Aucune famille enregistrée": "لا توجد عائلات مسجلة",
  "Activités récentes": "الأنشطة الأخيرة",
  "Tout voir": "عرض الكل",
  "Aucune activité récente": "لا توجد أنشطة حديثة.",
  "Nouveau don reçu": "تم استلام تبرع جديد",
  Anonyme: "مجهول",
  Donateur: "متبرع",
  "Cliquez pour agrandir": "انقر للتكبير",
  Fermer: "إغلاق",
  "À propos de ce graphique": "حول هذا الرسم البياني",

  // Sidebar brand + inherited member name
  // Key must stay dot-free: next-intl reads "." as namespace nesting.
  brandTagline: "إدارة. توزيع. تأثير.",
  "Minimum 2 (chef + conjoint)": "الحد الأدنى 2 (رب الأسرة + الزوج(ة))",
  "Minimum 1 (chef de famille)": "الحد الأدنى 1 (رب الأسرة)",
  "Repris automatiquement du chef de famille": "يؤخذ تلقائيًا من رب الأسرة",
  "Nom du chef de famille": "لقب رب الأسرة",
  // Chart descriptions
  barChartDescription:
    "مقارنة شهرية بين الإيرادات (التبرعات المحصّلة) والمصروفات (المبالغ الموزّعة) خلال الأشهر الستة الأخيرة، بالدينار الجزائري.",
  donutChartDescription:
    "توزيع العائلات حسب وضعها الاجتماعي: العائلات في وضع صعب (إعاقة أو مرض) والعائلات دون صعوبة خاصة.",

  // Dons page
  "Suivi des contributions reçues": "متابعة المساهمات المستلمة",
  "Total collecté": "إجمالي المحصّل",
  "Ce mois-ci": "هذا الشهر",
  "Mois en cours": "الشهر الجاري",
  "Don moyen": "متوسط التبرع",
  "par don": "لكل تبرع",
  "Historique des dons": "سجل التبرعات",
  "Tous les types": "كل الأنواع",
  Type: "النوع",
  Méthode: "الطريقة",
  Date: "التاريخ",
  Montant: "المبلغ",
  Statut: "الحالة",
  Complété: "مكتمل",
  "Aucun don enregistré": "لا يوجد أي تبرع مسجل.",

  // Familles page
  Actives: "النشطة",
  Inactives: "غير النشطة",
  Toutes: "الكل",
  Famille: "العائلة",
  Wilaya: "الولاية",
  Situation: "الحالة",
  Revenu: "الدخل",
  Santé: "الصحة",
  "Score SVF": "مؤشر SVF",
  Priorité: "الأولوية",
  "Aucune famille trouvée": "لم يتم العثور على أي عائلة.",
  "famille enregistrée": "عائلة مسجلة",
  "familles enregistrées": "عائلات مسجلة",

  // Common
  "Chargement…": "جارٍ التحميل…",
  Enregistrer: "حفظ",
  Annuler: "إلغاء",
  "Enregistrement…": "جارٍ الحفظ…",
  "Échec de l'enregistrement": "فشل الحفظ.",
  Membre: "عضو",
  sur: "من",
  ans: "سنة",
  "Non applicable": "غير قابل للتطبيق",
  Logement: "السكن",

  // Deleting a family (confirmation dialog + feedback)
  Supprimer: "حذف",
  "Supprimer la famille": "حذف العائلة",
  "Supprimer définitivement": "حذف نهائي",
  "Archiver seulement": "الأرشفة فقط",
  "Archivée": "مؤرشفة",
  "Réactiver la famille": "إعادة تفعيل العائلة",
  "Famille réactivée": "تمت إعادة تفعيل العائلة",
  "Échec de la réactivation": "فشلت إعادة التفعيل",
  "La famille restera visible dans « Inactives »":
    "ستبقى العائلة ظاهرة في « غير النشطة »",
  "Voulez-vous vraiment supprimer cette famille ?":
    "هل تريد فعلاً حذف هذه العائلة؟",
  "Les membres et les documents seront effacés définitivement, cette action est irréversible":
    "سيتم حذف الأفراد والوثائق نهائياً، وهذا الإجراء لا يمكن التراجع عنه.",
  "Suppression…": "جارٍ الحذف…",
  "Famille supprimée": "تم حذف العائلة.",
  "Famille archivée": "تمت أرشفة العائلة.",
  "Échec de la suppression": "فشل الحذف.",

  // Housing / marital status edge cases
  "Non requis pour une famille sans domicile": "غير مطلوب للعائلة بدون مسكن",
  "Veuillez indiquer le type de logement": "يرجى تحديد نوع السكن.",
  "Situation familiale mise à jour": "تم تحديث الحالة العائلية",
  "La situation familiale passera à Marié(e)":
    "ستتغير الحالة العائلية إلى متزوج(ة)",

  // Topbar (breadcrumb design)
  "Réduire le menu": "طيّ القائمة",
  Profil: "الملف الشخصي",

  // Donation form modal
  "Enregistrer une nouvelle contribution": "تسجيل مساهمة جديدة",
  "Enregistrer le don": "حفظ التبرع",
  "Montant (DA)": "المبلغ (دج)",
  "Type de don": "نوع التبرع",
  "Méthode de paiement": "طريقة الدفع",
  "Donateur identifié": "متبرع معروف",
  "Rechercher un donateur…": "ابحث عن متبرع…",
  Notes: "ملاحظات",
  "Référence, objet du don…": "المرجع، موضوع التبرع…",
  "Veuillez saisir un montant valide": "يرجى إدخال مبلغ صالح.",
  "Don enregistré avec succès": "تم تسجيل التبرع بنجاح.",
  // Key must stay dot-free: next-intl reads "." as namespace nesting.
  donationsAnonymousDisabled:
    "التبرعات المجهولة معطّلة لهذا المسجد. يرجى اختيار متبرع.",

  // Family form modal
  "Enregistrer une nouvelle famille bénéficiaire": "تسجيل عائلة مستفيدة جديدة",
  "Enregistrer la famille": "حفظ العائلة",
  Prénom: "الاسم",
  Nom: "اللقب",
  "Date de naissance du chef": "تاريخ ميلاد رب الأسرة",
  Téléphone: "الهاتف",
  "Situation familiale": "الحالة العائلية",
  "Conjoint(e)": "الزوج(ة)",
  "Nom du conjoint": "اسم الزوج(ة)",
  "Commune / Adresse": "البلدية / العنوان",
  "Composition & revenus": "التركيبة والدخل",
  "Nombre de membres": "عدد الأفراد",
  "Enfants scolarisés": "الأطفال المتمدرسون",
  Orphelins: "الأيتام",
  "Personnes âgées": "المسنّون",
  "Sources de revenu": "مصادر الدخل",
  "Champ obligatoire pour le calcul du score SVF": "حقل إجباري لحساب نقطة SVF",
  "Veuillez indiquer les sources de revenu": "يرجى تحديد مصادر الدخل",
  "Veuillez indiquer le nom du conjoint": "يرجى إدخال اسم الزوج(ة)",
  Salaire: "أجر",
  "Retraite / Pension": "تقاعد / معاش",
  "Aide sociale de l'État": "منحة اجتماعية من الدولة",
  "Soutien familial": "إعالة من الأقارب",
  "Petit commerce": "تجارة صغيرة",
  "Dons / Charité": "تبرعات / إحسان",
  "Autre source": "مصدر آخر",
  "Aucune source de revenu": "لا يوجد أي مصدر دخل",
  "Revenu mensuel (DA)": "الدخل الشهري (دج)",
  "État de santé": "الحالة الصحية",
  "Maladie chronique": "مرض مزمن",
  "Informations administratives": "معلومات إدارية",
  "N° CCP": "رقم الحساب البريدي",
  "identifiant unique": "معرّف فريد",
  "Statut du logement": "وضعية السكن",
  "Type de logement": "نوع السكن",
  "Précisez la maladie": "حدّد المرض",
  "Diabète, asthme…": "سكري، ربو…",
  "Informations complémentaires…": "معلومات إضافية…",
  "Veuillez remplir les champs obligatoires": "يرجى ملء الحقول الإلزامية.",
  "Famille ajoutée avec succès": "تمت إضافة العائلة بنجاح.",
  Propriétaire: "مالك",
  Locataire: "مستأجر",
  "Sans domicile": "بدون مسكن",
  Temporaire: "مؤقت",
  Maison: "منزل",
  Appartement: "شقة",

  // Member form modal
  "Ajouter un membre": "إضافة فرد",
  "Ajouter le membre": "إضافة الفرد",
  "Nouveau membre de la famille": "فرد جديد في العائلة",
  Rôle: "الدور",
  "Date de naissance": "تاريخ الميلاد",
  Occupation: "المهنة",
  "Étudiant, ouvrier…": "طالب، عامل…",
  "Diabète…": "سكري…",
  "Le prénom et le rôle sont obligatoires": "الاسم والدور إلزاميان.",
  "Membre ajouté avec succès": "تمت إضافة الفرد بنجاح.",
  "Chef de famille": "رب الأسرة",
  "Époux(se)": "الزوج(ة)",
  "Fils / Fille": "ابن / ابنة",
  Parent: "أحد الوالدين",

  // Family detail modal
  "Détails de la famille": "تفاصيل العائلة",
  Informations: "المعلومات",
  "Membres de la famille": "أفراد العائلة",
  Membres: "الأفراد",
  "Aucun membre enregistré": "لا يوجد أفراد مسجّلون.",
  // Incomplete-file notice (declared household size vs registered members).
  // Keys must stay dot-free: next-intl reads "." as namespace nesting.
  "Fiche incomplète": "الملف غير مكتمل",
  "membre(s) restant(s) à enregistrer sur":
    "فرد (أفراد) متبقّون للتسجيل من أصل",
  "Cette étape est obligatoire": "هذه الخطوة إلزامية",
  Compléter: "إكمال",
  Adresse: "العنوان",
  "Revenu mensuel": "الدخل الشهري",
  "Voir les détails": "عرض التفاصيل",

  // Family advanced filters
  Filtres: "عوامل التصفية",
  Tous: "الكل",
  Réinitialiser: "إعادة تعيين",

  // Donation categories
  "Zakat Mal": "زكاة المال",
  "Zakat Fitr": "زكاة الفطر",
  Sadaqah: "صدقة",
  don: "تبرع",
  Autre: "أخرى",

  // Payment methods
  Espèces: "نقداً",
  CCP: "الحساب البريدي الجاري",
  Virement: "تحويل",

  // Marital status
  Célibataire: "أعزب",
  "Marié(e)": "متزوج(ة)",
  "Veuf(ve)": "أرمل(ة)",
  "Divorcé(e)": "مطلّق(ة)",

  // Health
  Bonne: "جيدة",
  Maladie: "مرض",
  Handicap: "إعاقة",

  // Priority
  Urgent: "عاجل",
  Vulnérable: "هشّة",
  Modéré: "متوسطة",
  Faible: "ضعيفة",

  // Months (Algerian French -> Arabic)
  Janv: "جانفي",
  Févr: "فيفري",
  Mars: "مارس",
  Avr: "أفريل",
  Mai: "ماي",
  Juin: "جوان",
  Juil: "جويلية",
  Août: "أوت",
  Sept: "سبتمبر",
  Oct: "أكتوبر",
  Nov: "نوفمبر",
  Déc: "ديسمبر",

  // Member detail popup / member editing / balance container
  "Modifier": "تعديل",
  "Modifier le membre": "تعديل الفرد",
  "Modifier le chef de famille": "تعديل رب الأسرة",
  "Enregistrer les modifications": "حفظ التعديلات",
  "Détails du membre": "تفاصيل الفرد",
  "Âge": "العمر",
  "Enregistré le": "تاريخ التسجيل",
  "Dernière modification": "آخر تعديل",
  "Maladies déclarées": "الأمراض المصرّح بها",
  "Membre modifié avec succès": "تمّ تعديل الفرد بنجاح",
  "Membre supprimé": "تمّ حذف الفرد",
  "Supprimer ce membre ?": "حذف هذا الفرد؟",
  "Le membre sera retiré de la famille et le score SVF sera recalculé": "سيُحذف الفرد من العائلة وسيُعاد حساب نتيجة SVF",
  "Le rôle du chef de famille ne peut pas changer": "لا يمكن تغيير صفة رب الأسرة",
  "Utilisée par le score SVF (âge du chef)": "تُستعمل في نتيجة SVF (عمر رب الأسرة)",
  "Utilisé par le score SVF (santé du foyer)": "يُستعمل في نتيجة SVF (صحة الأسرة)",
  "Le nom, la date de naissance et le handicap sont reportés sur la fiche famille et le score SVF est recalculé": "الاسم وتاريخ الميلاد والإعاقة تُنقل إلى بطاقة العائلة ويُعاد حساب نتيجة SVF",
  "Ses informations alimentent le score SVF de la famille (âge, santé)": "معلوماته تدخل في نتيجة SVF للعائلة (العمر، الصحة)",
  "Le revenu doit être un nombre positif": "يجب أن يكون الدخل رقمًا موجبًا",
  "Cliquez sur un membre pour voir sa fiche": "انقر على فرد لعرض بطاقته",
  "voir la fiche": "عرض البطاقة",
  "Chef": "رب الأسرة",
  "Solde actuel": "الرصيد الحالي",
  "Solde négatif": "رصيد سالب",
  "Solde faible": "رصيد منخفض",
  "Disponible pour les distributions": "متاح للتوزيعات",

  // Envelopes module
  Enveloppes: "الأظرفة المالية",
  "Enveloppes Budgétaires": "الأظرفة المالية والميزانيات",
  "Nouvelle Enveloppe": "ظرف مالي جديد",
  "Budget total alloué": "إجمالي الميزانية المخصصة",
  "Total consommé": "إجمالي المستهلك",
  "Solde restant disponible": "الرصيد المتبقي المتاح",
  "Enveloppes en alerte": "أظرفة في حالة تنبيه",
  "Enveloppes épuisées": "أظرفة مستنفدة",
  "Seuil d'alerte": "حد التنبيه",
  "Budget alloué": "الميزانية المخصصة",
  "Consommé": "المستهلك",
  "Restant": "المتبقي",
  "Dépassement": "تجاوز الميزانية",
  "Modifier l'enveloppe": "تعديل الظرف المالي",
  "Clôturer l'enveloppe": "إغلاق الظرف المالي",
  "Rouvrir l'enveloppe": "إعادة فتح الظرف المالي",
  "Supprimer l'enveloppe": "حذف الظرف المالي",
  "Détails de l'enveloppe": "تفاصيل الظرف المالي",
};

// Most AR keys are the French string itself, so the FR catalogue can simply map
// every key onto itself. The exceptions are the few keys that are camelCase
// identifiers rather than French sentences (long chart descriptions); those
// need an explicit French value, otherwise the raw key is rendered in the UI.
const FR_OVERRIDES = {
  brandTagline: "G\u00e9rer. Distribuer. Impacter.",
  barChartDescription:
    "Comparaison mensuelle entre les entr\u00e9es (dons collect\u00e9s) et les sorties (montants distribu\u00e9s) sur les six derniers mois, en dinars alg\u00e9riens.",
  donutChartDescription:
    "R\u00e9partition des familles selon leur situation sociale\u00a0: les familles en situation difficile (handicap ou maladie) et celles sans difficult\u00e9 particuli\u00e8re.",
  donationsAnonymousDisabled:
    "Les dons anonymes sont d\u00e9sactiv\u00e9s pour cette mosqu\u00e9e. Veuillez s\u00e9lectionner un donateur.",
};

export const appMessages = {
  ar: AR,
  fr: {
    ...Object.fromEntries(Object.keys(AR).map((key) => [key, key])),
    ...FR_OVERRIDES,
  },
};