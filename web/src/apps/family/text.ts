// Words for the family app's own screens (sign-in, my referrals, how the
// estimate works). The referral page itself uses lib/i18n.

import type { LangCode } from "../../lib/i18n";

export interface FamilyText {
  appSub: string;
  signOut: string;
  signInTitle: string;
  signInLead: string;
  contactLabel: string;
  contactHint: string;
  sendCode: string;
  codeSent: (to: string) => string;
  codeLabel: string;
  verify: string;
  wrongCode: string;
  useOther: string;
  staffLink: string;
  privacy: string;
  homeTitle: string;
  homeLead: string;
  none: string;
  open: string;
  ref: string;
  waiting: string;
  booked: string;
  onHold: string;
  noEstimate: string;
  weeks: (lo: number, hi: number) => string;
  dataAsOf: (d: string) => string;
  how: {
    title: string;
    body: (clinic: string) => string;
    held: (pct: number, n: number) => string;
    gate: string;
    notMedical: string;
  };
  inbox: { title: string; note: string; empty: string; use: string };
  demoTry: string;
}

const en: FamilyText = {
  appSub: "For families",
  signOut: "Sign out",
  signInTitle: "Check your child's referral",
  signInLead: "Use the email or mobile number you gave the clinic. We'll send you a one-time code. No password or account needed.",
  contactLabel: "Email or mobile number",
  contactHint: "The one on your child's referral",
  sendCode: "Send me a code",
  codeSent: (to) => `We sent a 6-digit code to ${to}.`,
  codeLabel: "6-digit code",
  verify: "Sign in",
  wrongCode: "That code doesn't match or has expired. Check it, or ask for a new one.",
  useOther: "Use a different email or number",
  staffLink: "Clinic staff sign in",
  privacy: "We only use your email or number to sign you in and to send the updates you choose.",
  homeTitle: "Your referrals",
  homeLead: "Every referral linked to your email or number, at every clinic that uses ClearWait.",
  none: "We couldn't find a referral linked to this email or number yet. Clinics add referrals when their data is updated, usually overnight. If you were referred more than a week ago, please call the clinic.",
  open: "Open",
  ref: "Referral",
  waiting: "Waiting for first assessment",
  booked: "First assessment booked",
  onHold: "On hold",
  noEstimate: "No estimate yet",
  weeks: (lo, hi) => `About ${lo}–${hi} more weeks`,
  dataAsOf: (d) => `Clinic data updated ${d}`,
  how: {
    title: "How this estimate works",
    body: (clinic) =>
      `The range comes from ${clinic}'s own recent history: how many first assessments it has been able to offer each week, how many referrals join the line ahead, and how many families leave the list. We replay the line thousands of times and show the range most of those replays fall in.`,
    held: (pct, n) => `We checked this against the past: for ${pct}% of ${n} families at this clinic, the real wait fell inside the range we would have shown them.`,
    gate: "If a clinic doesn't have enough history for a reliable range, we don't show one.",
    notMedical: "A computer makes this estimate; people at the clinic decide the order of the line and book appointments.",
  },
  inbox: {
    title: "Demo inbox",
    note: "In the real service this arrives by email or text. The demo shows it here instead.",
    empty: "Nothing yet. Ask for a sign-in code.",
    use: "Use this code",
  },
  demoTry: "Demo: try",
};

const fr: FamilyText = {
  ...en,
  appSub: "Pour les familles",
  signOut: "Se déconnecter",
  signInTitle: "Suivre la demande de votre enfant",
  signInLead: "Utilisez le courriel ou le numéro de cellulaire donné à la clinique. Nous vous enverrons un code à usage unique. Aucun mot de passe ni compte.",
  contactLabel: "Courriel ou numéro de cellulaire",
  contactHint: "Celui indiqué dans la demande de votre enfant",
  sendCode: "M'envoyer un code",
  codeSent: (to) => `Nous avons envoyé un code à 6 chiffres à ${to}.`,
  codeLabel: "Code à 6 chiffres",
  verify: "Se connecter",
  wrongCode: "Ce code ne correspond pas ou a expiré. Vérifiez-le ou demandez-en un nouveau.",
  useOther: "Utiliser un autre courriel ou numéro",
  staffLink: "Connexion du personnel",
  privacy: "Nous utilisons votre courriel ou numéro uniquement pour vous connecter et vous envoyer les mises à jour choisies.",
  homeTitle: "Vos demandes",
  homeLead: "Toutes les demandes liées à votre courriel ou numéro, dans chaque clinique qui utilise ClearWait.",
  none: "Aucune demande n'est encore liée à ce courriel ou numéro. Les cliniques ajoutent les demandes lors de la mise à jour de leurs données, souvent la nuit. Si la demande date de plus d'une semaine, appelez la clinique.",
  open: "Ouvrir",
  ref: "Demande",
  waiting: "En attente de la première évaluation",
  booked: "Première évaluation fixée",
  onHold: "En pause",
  noEstimate: "Pas encore d'estimation",
  weeks: (lo, hi) => `Environ ${lo} à ${hi} semaines de plus`,
  dataAsOf: (d) => `Données de la clinique mises à jour le ${d}`,
  how: {
    title: "Comment cette estimation est faite",
    body: (clinic) =>
      `La fourchette vient de l'historique récent de ${clinic} : le nombre de premières évaluations offertes chaque semaine, les demandes qui passent devant et les familles qui quittent la liste. Nous rejouons la file des milliers de fois et montrons la fourchette où tombent la plupart des résultats.`,
    held: (pct, n) => `Vérifié sur le passé : pour ${pct} % de ${n} familles de cette clinique, l'attente réelle est tombée dans la fourchette que nous aurions montrée.`,
    gate: "Si une clinique n'a pas assez d'historique pour une fourchette fiable, nous n'en montrons pas.",
    notMedical: "Un ordinateur calcule l'estimation; l'ordre de la liste et les rendez-vous sont décidés par la clinique.",
  },
  inbox: { title: "Boîte de démonstration", note: "Dans le vrai service, ceci arrive par courriel ou texto.", empty: "Rien pour l'instant. Demandez un code.", use: "Utiliser ce code" },
  demoTry: "Démo : essayez",
};

const zhHans: FamilyText = {
  ...en,
  appSub: "家长端",
  signOut: "退出",
  signInTitle: "查看孩子的转介",
  signInLead: "请使用您留给诊所的邮箱或手机号，我们会发送一次性验证码。无需密码或注册账号。",
  contactLabel: "邮箱或手机号",
  contactHint: "转介时登记的那一个",
  sendCode: "发送验证码",
  codeSent: (to) => `验证码（6 位）已发送至 ${to}。`,
  codeLabel: "6 位验证码",
  verify: "登录",
  wrongCode: "验证码不正确或已过期，请检查或重新获取。",
  useOther: "换一个邮箱或号码",
  staffLink: "诊所员工登录",
  privacy: "您的邮箱或手机号只用于登录和发送您选择接收的更新。",
  homeTitle: "您的转介",
  homeLead: "与您的邮箱或手机号关联的所有转介，涵盖使用 ClearWait 的每家诊所。",
  none: "暂时没有找到与此邮箱或号码关联的转介。诊所更新数据（通常在夜间）后会显示。如果转介已超过一周，请致电诊所。",
  open: "查看",
  ref: "转介",
  waiting: "等待首次评估",
  booked: "首次评估已预约",
  onHold: "暂停中",
  noEstimate: "暂无估算",
  weeks: (lo, hi) => `大约还需 ${lo}–${hi} 周`,
  dataAsOf: (d) => `诊所数据更新于 ${d}`,
  how: {
    title: "这个估算是怎么来的",
    body: (clinic) => `区间来自${clinic}自己最近的记录：每周能安排多少首次评估、有多少转介排到前面、有多少家庭退出名单。我们把排队过程模拟上千次，显示大多数结果落入的区间。`,
    held: (pct, n) => `我们用过去的数据检验过：这家诊所的 ${n} 个家庭中，有 ${pct}% 的实际等待时间落在了当时会显示的区间内。`,
    gate: "如果诊所的历史数据不足以给出可靠的区间，我们就不显示。",
    notMedical: "估算由计算机完成；排队顺序和预约由诊所的工作人员决定。",
  },
  inbox: { title: "演示收件箱", note: "正式服务中会通过邮件或短信收到，演示版显示在这里。", empty: "暂无消息。请先获取验证码。", use: "使用此验证码" },
  demoTry: "演示：试试",
};

const zhHant: FamilyText = {
  ...zhHans,
  appSub: "家長端",
  signOut: "登出",
  signInTitle: "查看孩子的轉介",
  signInLead: "請使用您留給診所的電郵或手機號碼，我們會傳送一次性驗證碼。無需密碼或註冊帳戶。",
  contactLabel: "電郵或手機號碼",
  contactHint: "轉介時登記的那一個",
  sendCode: "傳送驗證碼",
  codeSent: (to) => `驗證碼（6 位）已傳送至 ${to}。`,
  codeLabel: "6 位驗證碼",
  verify: "登入",
  wrongCode: "驗證碼不正確或已過期，請檢查或重新取得。",
  useOther: "改用其他電郵或號碼",
  staffLink: "診所職員登入",
  privacy: "您的電郵或手機號碼只用於登入和傳送您選擇接收的更新。",
  homeTitle: "您的轉介",
  homeLead: "與您的電郵或手機號碼關聯的所有轉介，涵蓋使用 ClearWait 的每間診所。",
  none: "暫時找不到與此電郵或號碼關聯的轉介。診所更新資料（通常在夜間）後會顯示。如轉介已超過一週，請致電診所。",
  open: "查看",
  ref: "轉介",
  waiting: "等待首次評估",
  booked: "首次評估已預約",
  onHold: "暫停中",
  noEstimate: "暫無估算",
  weeks: (lo, hi) => `大約還需 ${lo}–${hi} 週`,
  dataAsOf: (d) => `診所資料更新於 ${d}`,
  how: {
    title: "這個估算是怎樣得出的",
    body: (clinic) => `區間來自${clinic}自己最近的紀錄：每週能安排多少首次評估、有多少轉介排到前面、有多少家庭退出名單。我們把排隊過程模擬上千次，顯示大部分結果落入的區間。`,
    held: (pct, n) => `我們用過去的資料檢驗過：這間診所的 ${n} 個家庭中，有 ${pct}% 的實際等候時間落在當時會顯示的區間內。`,
    gate: "如果診所的歷史資料不足以給出可靠的區間，我們就不顯示。",
    notMedical: "估算由電腦完成；排隊次序和預約由診所職員決定。",
  },
  inbox: { title: "示範收件匣", note: "正式服務中會以電郵或短訊收到，示範版顯示在這裡。", empty: "暫無訊息。請先取得驗證碼。", use: "使用此驗證碼" },
  demoTry: "示範：試試",
};

const es: FamilyText = {
  ...en,
  appSub: "Para familias",
  signOut: "Cerrar sesión",
  signInTitle: "Consulte la derivación de su hijo",
  signInLead: "Use el correo o el número de celular que dio a la clínica. Le enviaremos un código de un solo uso. Sin contraseña ni cuenta.",
  contactLabel: "Correo o número de celular",
  contactHint: "El que figura en la derivación de su hijo",
  sendCode: "Enviarme un código",
  codeSent: (to) => `Enviamos un código de 6 dígitos a ${to}.`,
  codeLabel: "Código de 6 dígitos",
  verify: "Entrar",
  wrongCode: "El código no coincide o ha caducado. Revíselo o pida uno nuevo.",
  useOther: "Usar otro correo o número",
  staffLink: "Acceso del personal de la clínica",
  privacy: "Solo usamos su correo o número para que entre y para enviarle las novedades que elija.",
  homeTitle: "Sus derivaciones",
  homeLead: "Todas las derivaciones vinculadas a su correo o número, en cada clínica que usa ClearWait.",
  none: "Aún no encontramos una derivación vinculada a este correo o número. Las clínicas las añaden al actualizar sus datos, normalmente de noche. Si la derivación tiene más de una semana, llame a la clínica.",
  open: "Abrir",
  ref: "Derivación",
  waiting: "Esperando la primera evaluación",
  booked: "Primera evaluación reservada",
  onHold: "En pausa",
  noEstimate: "Aún sin estimación",
  weeks: (lo, hi) => `Unas ${lo}–${hi} semanas más`,
  dataAsOf: (d) => `Datos de la clínica actualizados el ${d}`,
  how: {
    title: "Cómo se calcula esta estimación",
    body: (clinic) =>
      `El rango sale del historial reciente de ${clinic}: cuántas primeras evaluaciones ofreció cada semana, cuántas derivaciones pasan por delante y cuántas familias dejan la lista. Repetimos la fila miles de veces y mostramos el rango donde cae la mayoría.`,
    held: (pct, n) => `Lo comprobamos con el pasado: para el ${pct} % de ${n} familias de esta clínica, la espera real cayó dentro del rango que les habríamos mostrado.`,
    gate: "Si una clínica no tiene suficiente historial para un rango fiable, no mostramos ninguno.",
    notMedical: "Una computadora calcula la estimación; el orden de la lista y las citas los decide la clínica.",
  },
  inbox: { title: "Bandeja de demostración", note: "En el servicio real esto llega por correo o mensaje de texto.", empty: "Nada todavía. Pida un código.", use: "Usar este código" },
  demoTry: "Demo: pruebe",
};

const ar: FamilyText = {
  ...en,
  appSub: "للعائلات",
  signOut: "تسجيل الخروج",
  signInTitle: "تابِع إحالة طفلك",
  signInLead: "استخدم البريد الإلكتروني أو رقم الجوال الذي أعطيته للعيادة. سنرسل لك رمزًا لمرة واحدة. لا حاجة لكلمة مرور أو حساب.",
  contactLabel: "البريد الإلكتروني أو رقم الجوال",
  contactHint: "المسجّل في إحالة طفلك",
  sendCode: "أرسل لي رمزًا",
  codeSent: (to) => `أرسلنا رمزًا من 6 أرقام إلى ${to}.`,
  codeLabel: "رمز من 6 أرقام",
  verify: "دخول",
  wrongCode: "الرمز غير صحيح أو انتهت صلاحيته. تحقق منه أو اطلب رمزًا جديدًا.",
  useOther: "استخدم بريدًا أو رقمًا آخر",
  staffLink: "دخول موظفي العيادة",
  privacy: "نستخدم بريدك أو رقمك فقط لتسجيل دخولك ولإرسال التحديثات التي تختارها.",
  homeTitle: "إحالاتك",
  homeLead: "كل الإحالات المرتبطة ببريدك أو رقمك، في كل عيادة تستخدم ClearWait.",
  none: "لم نجد بعد إحالة مرتبطة بهذا البريد أو الرقم. تضيف العيادات الإحالات عند تحديث بياناتها، عادةً ليلًا. إذا مضى على الإحالة أكثر من أسبوع، يُرجى الاتصال بالعيادة.",
  open: "فتح",
  ref: "الإحالة",
  waiting: "بانتظار التقييم الأول",
  booked: "تم حجز التقييم الأول",
  onHold: "متوقفة مؤقتًا",
  noEstimate: "لا يوجد تقدير بعد",
  weeks: (lo, hi) => `نحو ${lo}–${hi} أسابيع إضافية`,
  dataAsOf: (d) => `حُدّثت بيانات العيادة في ${d}`,
  how: {
    title: "كيف نحسب هذا التقدير",
    body: (clinic) => `يأتي النطاق من السجل الحديث لـ ${clinic}: عدد التقييمات الأولى التي قدّمتها كل أسبوع، وعدد الإحالات التي تتقدّم في الدور، وعدد العائلات التي تغادر القائمة. نعيد محاكاة الدور آلاف المرات ونعرض النطاق الذي تقع فيه معظم النتائج.`,
    held: (pct, n) => `تحققنا من ذلك على بيانات سابقة: لدى ${pct}% من ${n} عائلة في هذه العيادة، وقع الانتظار الفعلي ضمن النطاق الذي كنا سنعرضه.`,
    gate: "إذا لم يكن لدى العيادة سجل كافٍ لنطاق موثوق، فلن نعرض أي نطاق.",
    notMedical: "يحسب الحاسوب هذا التقدير؛ أما ترتيب الدور والمواعيد فتقرّرها العيادة.",
  },
  inbox: { title: "صندوق العرض التجريبي", note: "في الخدمة الحقيقية يصل هذا عبر البريد أو رسالة نصية.", empty: "لا شيء بعد. اطلب رمز الدخول.", use: "استخدم هذا الرمز" },
  demoTry: "تجربة: جرّب",
};

export const FAMILY_TEXT: Record<LangCode, FamilyText> = { en, fr, "zh-Hans": zhHans, "zh-Hant": zhHant, es, ar };
