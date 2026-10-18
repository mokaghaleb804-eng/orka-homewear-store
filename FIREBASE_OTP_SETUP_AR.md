# إعداد Firebase لحسابات ORKA HOMEWEAR

## ما تم تجهيزه في الكود
- تسجيل دخول برقم الموبايل وكلمة المرور بعد ربط كلمة المرور بحساب الهاتف الموثّق.
- استخدام Firebase Authentication لتخزين بيانات الاعتماد؛ لا تُحفظ كلمات المرور داخل Firestore أو localStorage.
- التحقق برسالة SMS عند إنشاء الحساب أو استعادة كلمة المرور.
- ملف العميل في `customers/{uid}` مع نقاط الولاء وعنوان شحن واحد قابل للتعديل.
- حفظ الطلبات للحسابات المسجّلة، مع دعم محاولة حفظ طلب الضيف بمعرّف مستخدم فارغ.
- ملف `firestore.rules` مقترح لحماية ملفات العملاء، وإتاحة قراءة طلبات العميل نفسه، وحصر تعديل حالة الطلبات والنقاط على المسؤول.

## خطوات مطلوبة من مالك المشروع في Firebase Console
1. افتح مشروع `orka-homewear-e63db`.
2. من **Authentication > Sign-in method** فعّل **Phone** و **Email/Password**. تفعيل Email/Password مطلوب لتسجيل الدخول بكلمة المرور.
3. من **Authentication > Settings > Authorized domains** تأكد أن `orkahomewear.com` و `www.orkahomewear.com` مضافان حسب النطاقات المستخدمة.
4. في **Authentication > Phone numbers for testing** أضف رقم اختبار وكودًا ثابتًا للتجربة أولًا؛ لا تستخدم رقم عميل حقيقي في الاختبارات.
5. عند تفعيل SMS الحقيقية، راجع إعدادات الفوترة وحدود الرسائل والتكلفة قبل أي ترقية. لا توجد ترقية أو عملية دفع نفّذت من الكود.
6. من **Firestore Database > Rules** راجع ملف `firestore.rules` المنشور في GitHub ثم انسخ محتواه إلى محرر القواعد واضغط **Publish**. رفع الملف إلى GitHub وحده لا ينشر قواعد Firestore.
7. احتفظ بمستند المسؤول الحالي `admins/{uid}` مع `role: "admin"`. لا تنشئ هذا المستند لأي عميل؛ حساب المسؤول فقط هو الذي يمكنه اعتماد التسليم وإضافة النقاط.

## نقاط مهمة قبل الإطلاق
- خطأ `auth/billing-not-enabled` ظهر سابقًا عند محاولة إرسال SMS حقيقية؛ لذلك لا نعتبر التحقق الحقيقي جاهزًا حتى يُختبر إعداد Firebase. استخدم أرقام الاختبار لتجنب إرسال رسائل مدفوعة.
- طلبات الضيوف تُحفظ دون ربطها بحساب عميل، ويستطيع المسؤول رؤيتها بعد نشر القواعد. لن تظهر طلبات الضيف في سجل حساب شخصي تلقائيًا.
- القواعد تمنع العميل من تعديل رصيد نقاطه أو قراءة طلبات عملاء آخرين. اختبرها في Firebase Rules Playground أو Emulator قبل الإطلاق، وتأكد أن أي قواعد موجودة لا تحتوي صلاحيات عامة أوسع.
- واجهة المتجر ما زالت تعرض بعض المنتجات والأسعار كعينات تجريبية؛ لا تعتبر المتجر جاهزًا للبيع الفعلي حتى اعتماد المنتجات والأسعار وسياسة الشحن.
- Passkeys والبصمة/Face ID مؤجلة للمرحلة الثانية كما تم الاتفاق.

## روابط رسمية
- Phone authentication: https://firebase.google.com/docs/auth/web/phone-auth
- Email/password authentication: https://firebase.google.com/docs/auth/web/password-auth
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase pricing: https://firebase.google.com/pricing
