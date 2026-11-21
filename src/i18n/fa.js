// فارسی (Persian). Same keys as en.js; anything missing falls back to English.
require('dotenv').config();
const { SERVER_BASE_URL } = require('../constants/server.constant');

const channel = () => process.env.MAIN_CHANNEL_USERNAME;
const botLink = () => `https://t.me/${process.env.BOT_USERNAME}`;
const formatBytes = (n) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const progressBar = (percent, width = 12) => { const n = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width); return '▓'.repeat(n) + '░'.repeat(width - n); };

const fa = {
  code: 'fa',
  dir: 'rtl',
  nativeName: 'فارسی',
  flag: '🇮🇷',
  aiLanguage: 'Persian (Farsi)',
  joinNames: (names) => (names.length > 1 ? `${names.slice(0, -1).join('، ')} و ${names.at(-1)}` : names[0] || ''),
  listSep: '، ',
  someone: 'یک نفر',
  aFriend: 'یک دوست',
  them: 'او',
  they: 'او',
  their: 'او',
  yourFriend: 'دوستت',

  menu: {
    SET_MOOD: '🤩 حس جدید',
    REPORT: '📊 گزارش',
    EXPORT: '📥 خروجی',
    SHARE: '🚀 اشتراک',
    VISIBILITY_PUBLIC: '👀 عمومی کردن حس من',
    VISIBILITY_PRIVATE: '👻 خصوصی کردن حس من',
    PERSONALITY_TEST: '🧠 تست شخصیت',
    MY_PERSONALITY: '🧠 شخصیت من',
    TALK: '💬 گفت‌وگو',
    END_TALK: '🛑 پایان گفت‌وگو',
    BACKUP_NOW: '💾 پشتیبان‌گیری',
    LANGUAGE: '🌐 زبان',
  },
  menuUpdatedMsg: () => '🆕 منوی شما به‌روز شد.',

  commands: {
    start: 'شروع ربات',
    set_mood: 'ثبت حس الانت',
    report: 'گزارش حس‌های روزهای اخیر',
    export: 'دریافت همه حس‌ها و یادداشت‌ها در یک فایل',
    share: 'اشتراک حست با دوستان',
    friends: 'کسانی که دنبالشان می‌کنی و دنبالت می‌کنند',
    personality_test: 'انجام تست شخصیت',
    my_personality: 'دیدن پروفایل شخصیتی',
    talk: 'گفت‌وگو با همراه هوش مصنوعی',
    end_talk: 'پایان گفت‌وگو',
    reminders: 'روشن یا خاموش کردن یادآورها',
    timezone: 'تنظیم منطقه زمانی (مثلاً /timezone Tehran)',
    language: 'تغییر زبان ربات',
    set_public: 'عمومی کردن حس (کد جاسازی)',
    set_private: 'خصوصی کردن حس',
    set_openai_key: 'افزودن کلید OpenAI برای تحلیل هوشمند',
    remove_openai_key: 'حذف کلید OpenAI',
    backup: 'مدیران: پشتیبان‌گیری از پایگاه داده',
    help: 'فهرست همه دستورها',
  },

  languageChooseMsg: () => '🌐 زبانت را انتخاب کن:',
  languageChangedMsg: () => '✅ زبان ربات فارسی شد.',

  moods: {
    happy: 'خوشحال', relaxed: 'آرام', excited: 'هیجان‌زده', motivated: 'باانگیزه', neutral: 'معمولی',
    confused: 'گیج', bored: 'بی‌حوصله', uncertain: 'مردد', disappointed: 'ناامید', anxious: 'مضطرب',
    angry: 'عصبانی', sad: 'غمگین', overwhelmed: 'کلافه', overthinking: 'درگیر فکر', tired: 'خسته',
    nervous: 'پراسترس', sick: 'مریض', naughty: 'شیطون',
  },
  moodGroups: { positive: 'مثبت', motivated: 'باانگیزه', anxious: 'مضطرب', negative: 'منفی', drained: 'بی‌رمق', calm: 'آرام' },
  moodSavedToast: () => 'حست ثبت شد!',

  chooseMoodMsg: () => `وقتشه از حالت بگی! <b>حسی</b> رو انتخاب کن که الان بهتر از همه توصیفت می‌کنه:`,
  notImplementedMsg: () => `این بخش هنوز آماده نیست. منتظر به‌روزرسانی‌ها باش!`,
  helpMsg: () => `
دستورهایی که می‌تونی استفاده کنی:
/start - شروع ربات و پیام خوش‌آمد
/help - فهرست دستورها
/set_mood - انتخاب حس از فهرست
/language - تغییر زبان ربات (English، فارسی، Русский)
/export - دریافت همه حس‌ها و یادداشت‌ها (با روز و ساعت) در یک فایل
/friends - ببین چه کسانی را دنبال می‌کنی و چه کسانی دنبالت می‌کنند
/reminders - روشن یا خاموش کردن یادآور ثبت حس
/timezone - تنظیم منطقه زمانی، مثلاً /timezone Tehran یا /timezone +3:30
/set_private - خصوصی کردن حس
/set_public - عمومی کردن حس
/report - گزارش حس‌ها
/share - لینکی بفرست تا دوستانت حست را ببینند
/personality_test - انجام تست شخصیت
/my_personality - دیدن پروفایل شخصیتی
/talk - گفت‌وگو با همراه هوش مصنوعی (کلید OpenAI خودت لازمه)
/end_talk - پایان گفت‌وگو و برگشت به یادداشت‌ها
/backup - (مدیران) پشتیبان‌گیری از پایگاه داده
/set_openai_key - افزودن کلید OpenAI برای تحلیل هوشمند در گزارش هفتگی
/remove_openai_key - حذف کلید OpenAI و خاموش کردن تحلیل هوشمند
`,
  welocmeMsg: (name) => `
سلام ${name}،
به Mood Pal خوش اومدی، همراه شخصی تو برای ثبت حس و حال.

حست رو ثبت کن و با <i>احساساتت</i> در ارتباط بمون.
از بین حس‌های مختلف، اون رو انتخاب کن که الان بیشتر به حالت می‌خوره.

Mood Pal نشونت می‌ده <i>حالت</i> در طول زمان چطور تغییر می‌کنه تا شناخت بهتری از <i>سلامت عاطفیت</i> داشته باشی.

برای یادآوری روزانه ثبت حس، عضو کانال ما شو
@${channel()}

${fa.helpMsg()}
`,
  joinChannelMsg: () => '🤩 لطفاً عضو کانال MoodPals شو تا برای ثبت حست بهت یادآوری کنیم.',
  joinButton: () => '👉 عضویت',

  noMoodMsg: () => `😔 هنوز حسی ثبت نکردی. با /set_mood حست رو ثبت کن. 🤩`,
  addNoteMsg: () => `📝 حالا می‌تونی برای حست یادداشت بذاری. یادداشتت رو همین پایین بنویس:`,
  noteSavedMsg: () => `✅ یادداشتت برای این حس ذخیره شد!`,

  moodPrivateMsg: () => `👻 حس تو الان خصوصیه`,
  moodPublicMsg: (id) => `
👀 حس تو الان عمومیه.

👨🏻‍💻 می‌تونی این‌ها رو به سایتت اضافه کنی تا حست رو نشون بدی.

✅ حس متحرک WebP:
<code>&lt;img src="${SERVER_BASE_URL}/user/${id}/mood/animated" /&gt;</code>

✅ حس متحرک TGS:
اول این اسکریپت رو قبل از تگ mood-pal بارگذاری کن
<code>&lt;script src="${SERVER_BASE_URL}/public/lib/tgs-player.js"&gt;&lt;/script&gt;</code>

بعد این رو داخل body صفحه بذار
<code>&lt;mood-pal src="${SERVER_BASE_URL}/user/${id}/mood/tgs" &gt;&lt;/mood-pal&gt;</code>

✅ حس به شکل ایموجی:
<code>${SERVER_BASE_URL}/user/${id}/mood/emoji</code>
`,

  showReportMsg: (user, days) => `
👻 سلام ${user.first_name}،
📊 این گزارش حس‌های ${days} روز اخیر توست`,
  reportMsg: () => `
📆 بازه گزارش رو انتخاب کن:
`,
  reportDaysButton: (days) => `${days} روز`,
  reportSentToast: () => '📊 گزارش فرستاده شد!',
  reportFailedToast: () => '❌ ساختن گزارش نشد. دوباره امتحان کن.',

  createShareLinkMsg: (user) => `
👨🏻‍💻 این پیام رو برای دوستانت بفرست تا حست رو ببینند:

👀 برای دیدن <a href="${botLink()}?start=sm-${user._id}">حس ${user.first_name}</a> اینجا رو بزن

🔗 <code>${botLink()}?start=sm-${user._id}</code>
`,
  askForShareMoodMsg: (follower) => `👀 ${follower.first_name} می‌خواد حست رو ببینه.`,
  waitingForShareMsg: (follower) => `👀 منتظر اجازه ${follower.first_name} برای دیدن حسش هستیم.`,
  shareAllowedMsg: (follower) => `👀 حالا ${follower.first_name} می‌تونه حست رو ببینه.`,
  sharePermissionGrantedMsg: (followed) => `✅ ${followed.first_name} اجازه داد حسش رو ببینی.`,
  hasAlreadySharedMsg: (followed) => `🤩 ${followed.first_name} قبلاً حسش رو با تو به اشتراک گذاشته.`,
  followBackAskMsg: (follower) => `می‌خوای حس ${follower.first_name} رو هم ببینی؟`,
  followBackGiveMsg: (followed) => `بذاری ${followed.first_name} هم حست رو ببینه؟`,
  alreadySeesYouMsg: (other) => `🤝 ${other.first_name} از قبل حست رو می‌بینه.`,
  sharedBackMsg: (followed) => `🤝 انجام شد. حالا ${followed.first_name} هم حست رو می‌بینه.`,
  sharedBackNoticeMsg: (follower) => `🤝 ${follower.first_name} هم حسش رو با تو به اشتراک گذاشت. حالا حس همدیگه رو می‌بینید.`,
  rejectShareMsg: (follower) => `❌ درخواست ${follower.first_name} برای دیدن حست رو رد کردی.`,
  followBackAskButton: (name) => `👀 درخواست دیدن حس ${name}`,
  followBackGiveButton: (name) => `🤝 ${name} هم حسم رو ببینه`,
  viewUserButton: (name) => `👤 دیدن ${name}`,
  allowButton: () => '✅ اجازه می‌دم',
  rejectButton: () => '❌ رد',

  friendsNoneMsg: () => '🫂 هنوز حست رو با کسی به اشتراک نذاشتی.\n🚀 اشتراک رو بزن و لینکت رو برای یک دوست بفرست.',
  friendsTitle: () => '🫂 <b>دوستانت</b>',
  friendsYouSee: (list) => `👀 <b>حس این‌ها رو می‌بینی:</b> ${list}`,
  friendsSeeYou: (list) => `🙋 <b>این‌ها حست رو می‌بینند:</b> ${list}`,
  nobody: () => 'هیچ‌کس',
  friendsHint: () => 'برای تغییر بزن. به کسی خبر داده نمی‌شه.',
  friendsUnfollowButton: (name) => `🚫 دنبال نکردن ${name}`,
  friendsBothButton: () => '💔 هر دو',
  friendsHideButton: (name) => `🙈 پنهان کردن حسم از ${name}`,
  friendsUnfollowedToast: (name) => `دیگه حس ${name} رو نمی‌بینی`,
  friendsRemovedToast: (name) => `${name} دیگه حست رو نمی‌بینه`,
  friendsBothToast: (name) => `تو و ${name} دیگه حس همدیگه رو نمی‌بینید`,

  exportNoMoodsMsg: () => 'هنوز هیچ حسی ثبت نکردی. با 🤩 حس جدید یکی انتخاب کن تا توی خروجی بیاد.',
  exportTooSoonMsg: (s) => `فایلت در راهه. ${s} ثانیه دیگه می‌تونی دوباره خروجی بگیری.`,
  exportFailedMsg: () => 'متأسفم، الان نتونستم خروجی رو بسازم. یک دقیقه دیگه دوباره امتحان کن.',
  exportCaption: (count, tz) => `📥 دفتر حس‌های تو: ${count} حس با یادداشت، زمان‌ها به وقت ${tz}. در Excel، Numbers یا Google Sheets باز می‌شه.`,
  exportColumns: ['تاریخ', 'روز هفته', 'ساعت', 'منطقه زمانی', 'حس', 'یادداشت'],

  reminderCheckInMsg: () => `⏰ <b>وقت ثبت حس</b>\nالان چه حسی داری؟ حسی رو انتخاب کن که بیشتر بهت می‌خوره:`,
  remindersPausedMsg: () => '⏰ یادآورهای ثبت حس فعلاً برای همه متوقف شده‌اند.',
  remindersOffMsg: () => '🔕 یادآورهای ثبت حس <b>خاموش</b> هستند.',
  remindersOnMsg: (times, tz) => `⏰ یادآورهای ثبت حس <b>روشن</b> هستند: ${times} (${tz}).\nساعت‌ها رو در مینی‌اپ ← تنظیمات عوض کن، و منطقه زمانی رو با /timezone.`,
  remindersOffButton: () => '🔕 خاموش کردن یادآورها',
  remindersOnButton: () => '⏰ روشن کردن یادآورها',
  remindersOnToast: () => 'یادآورها روشن شدند',
  remindersOffToast: () => 'یادآورها خاموش شدند. با /reminders دوباره روشنشان کن',
  tzStatusMsg: (tz, offset, localTime) => `🌍 منطقه زمانی تو: <b>${tz}</b> (${offset}). الان اونجا ساعت ${localTime} است.`,
  tzDefaultHint: () => `این پیش‌فرضه؛ منطقه خودت رو تنظیم کن تا یادآورها به وقت محلی خودت برسند.`,
  tzRemindersLine: (times) => `⏰ یادآورها: ${times} به وقت همین منطقه.`,
  tzDoneMsg: () => '✅ انجام شد.',
  tzHowToMsg: () => `برای تغییر، /timezone رو با اسم یک شهر یا اختلاف ساعت بفرست، مثلاً\n<code>/timezone Tehran</code>\n<code>/timezone New York</code>\n<code>/timezone +3:30</code>\nیا از مینی‌اپ ← تنظیمات انتخابش کن.`,
  tzBackToDefaultButton: (def) => `↩︎ برگشت به پیش‌فرض (${def})`,
  tzNotFoundMsg: (q) => `منطقه زمانی‌ای برای «${q}» پیدا نکردم. اسم یک شهر بزرگ نزدیک رو امتحان کن (<code>/timezone Tehran</code>) یا اختلاف با UTC رو (<code>/timezone +3:30</code>).`,
  tzWhichOneMsg: () => 'کدوم مال توست؟',
  tzUnknownToast: () => 'منطقه زمانی ناشناخته',
  tzSetToast: (tz) => `منطقه زمانی: ${tz}`,
  tzResetToast: () => 'برگشت به منطقه زمانی پیش‌فرض',

  askOpenAIKeyMsg: () => `
🧠 <b>تحلیل هوشمند حس‌ها</b> با کلید OpenAI <i>خودت</i> کار می‌کنه، پس اعتبار کس دیگه‌ای خرج نمی‌شه.

🔑 در جواب همین پیام، کلید OpenAI API خودت رو بفرست (با <code>sk-</code> شروع می‌شه).
می‌تونی از اینجا بسازیش: https://platform.openai.com/api-keys

🔒 کلیدت رمزنگاری‌شده نگه داشته می‌شه و فقط برای تحلیل حس‌های هفتگی <b>خودت</b> استفاده می‌شه. پیامی که کلید داخلشه بلافاصله بعد از ذخیره پاک می‌شه.

هر وقت خواستی با /remove_openai_key پاکش کن.
`,
  openAIKeyInvalidFormatMsg: () => `❌ این شبیه کلید OpenAI نیست. باید با <code>sk-</code> شروع بشه. دوباره /set_openai_key رو امتحان کن.`,
  openAIKeyVerifyingMsg: () => `⏳ در حال بررسی کلیدت با OpenAI…`,
  openAIKeySavedMsg: () => `✅ کلید OpenAI تأیید و ذخیره شد. از این به بعد همراه گزارش هفتگی، تحلیل هوشمند هم می‌گیری. 🧠`,
  openAIKeyRejectedMsg: () => `❌ OpenAI این کلید رو قبول نکرد. بررسیش کن و دوباره /set_openai_key رو بزن.`,
  openAIKeyErrorMsg: () => `⚠️ الان نتونستم برای بررسی کلید به OpenAI وصل بشم. کمی بعد دوباره امتحان کن.`,
  openAIKeyRemovedMsg: () => `🗑 کلید OpenAI حذف شد. تحلیل هوشمند خاموشه.`,
  openAIKeyNotSetMsg: () => `ℹ️ کلید OpenAI ذخیره‌شده‌ای نداری. با /set_openai_key اضافه‌اش کن.`,
  openAIKeyStoppedWorkingMsg: () => `⚠️ OpenAI کلید ذخیره‌شده‌ات رو قبول نکرد، برای همین تحلیل هوشمند این هفته انجام نشد. با /set_openai_key به‌روزش کن.`,

  TALK_DISCLAIMER: `🤖 <b>لطفاً اول این رو بخون</b>
• داری با یک <b>ربات هوش مصنوعی</b> حرف می‌زنی، نه یک انسان و نه یک درمانگر. سعی می‌کنه مثل یک روان‌شناس همدل جواب بده، اما <b>دقیق نیست</b> و ممکنه اشتباه کنه.
• این <b>جایگزین</b> درمان، توصیه پزشکی یا تشخیص نیست. اگه در خطری یا به آسیب زدن به خودت فکر می‌کنی، همین الان با شماره اورژانس یا خط کمک فوری تماس بگیر.
• اگه کلید OpenAI خودت رو اضافه کرده باشی (/set_openai_key) با <b>همون</b> کار می‌کنه، وگرنه با هوش مصنوعی مشترک MoodPal. پیام‌هات به همون سرویس فرستاده می‌شن و اینجا ذخیره می‌شن تا گفت‌وگو پیوستگی داشته باشه.`,
  talkIntroMsg: (name) => `
💬 <b>بیا حرف بزنیم${name ? `، ${name}` : ''}.</b>

${fa.TALK_DISCLAIMER}

هر وقت آماده بودی، بگو چی تو ذهنته. هر وقت خواستی 🛑 <b>پایان گفت‌وگو</b> (یا /end_talk) رو بفرست. بعد از اون، پیام‌هات مثل قبل به‌عنوان یادداشت حس ذخیره می‌شن.
`,
  talkNeedsKeyMsg: () => `
💬 <b>گفت‌وگو</b> با کلید OpenAI خودت کار می‌کنه، پس هزینه‌اش با کس دیگه‌ای نیست.

🔑 با /set_openai_key یکی اضافه کن، بعد دوباره 💬 گفت‌وگو رو بزن.

${fa.TALK_DISCLAIMER}
`,
  talkEndedMsg: () => `🛑 گفت‌وگو تموم شد. مراقب خودت باش. 💛

از الان پیام‌هات دوباره به‌عنوان یادداشت حس ذخیره می‌شن.`,
  talkNotActiveMsg: () => `ℹ️ الان در گفت‌وگو نیستی. برای شروع 💬 گفت‌وگو رو بزن.`,
  talkErrorMsg: () => `⚠️ الان نتونستم جواب بگیرم. کمی بعد دوباره امتحان کن، یا با /end_talk تمومش کن.`,
  talkModelUnavailableMsg: (model) => `⚠️ حساب OpenAI تو به مدل <b>${model}</b> دسترسی نداره. از مینی‌اپ ← تنظیمات ← مدل یکی دیگه انتخاب کن، بعد دوباره 💬 گفت‌وگو رو بزن.`,
  talkKeyRejectedMsg: () => `❌ OpenAI کلیدت رو قبول نکرد، برای همین نمی‌تونم جواب بدم. با /set_openai_key به‌روزش کن و دوباره 💬 گفت‌وگو رو بزن.`,
  talkSafetyFooterMsg: () => `
🛟 <b>اگه ممکنه در خطر باشی، لطفاً منتظر یک ربات نمون.</b> همین الان با کسی که بهش اعتماد داری، خط کمک فوری یا شماره اورژانس تماس بگیر. من یک هوش مصنوعی‌ام و نمی‌تونم ازت محافظت کنم. یک آدم واقعی می‌تونه.`,
  talkAboutNoteMsg: () => `💬 می‌خوای درباره‌اش حرف بزنیم؟`,
  talkAboutButton: () => '💬 درباره‌اش حرف بزنیم',
  talkSharedNoteMsg: (provider, left, limit) => `🎁 از هوش مصنوعی رایگان MoodPal (${provider}) استفاده می‌کنی: امروز <b>${left} از ${limit}</b> پیام باقی مونده. پیام‌هات به ${provider} فرستاده می‌شن. برای گفت‌وگوی نامحدود، کلید OpenAI خودت رو با /set_openai_key اضافه کن.`,
  talkLimitMsg: (limit) => `⏳ ${limit} پیام رایگان امروزت تموم شد. نیمه‌شب دوباره شارژ می‌شه، یا برای گفت‌وگوی نامحدود کلید OpenAI خودت رو با /set_openai_key اضافه کن. 💛`,
  talkDailyCapMsg: () => `⏳ هوش مصنوعی رایگان MoodPal برای امروز پر شده. فردا دوباره امتحان کن، یا کلید OpenAI خودت رو با /set_openai_key اضافه کن. 💛`,
  talkSharedUnavailableMsg: () => `⚠️ هوش مصنوعی رایگان MoodPal الان کار نمی‌کنه. کمی بعد دوباره امتحان کن، یا کلید OpenAI خودت رو با /set_openai_key اضافه کن.`,
  talkReminderMsg: () => `<i>🤖 یادآوری: من هوش مصنوعی‌ام، نه درمانگر، و ممکنه اشتباه کنم.</i>`,
  talkFallbackReply: () => 'یکم بیشتر بگو، چی شده؟',
  insightFallback: () => 'متأسفم، الان نتونستم حس‌هات رو تحلیل کنم.',

  backupStartedMsg: () => `💾 در حال ساختن و بارگذاری نسخه پشتیبان…`,
  backupDoneMsg: (r) => `
✅ <b>نسخه پشتیبان فرستاده شد.</b>

📦 ${r.total_parts} فایل · ${r.total_documents} سند
🗂 ${formatBytes(r.bytes)} بارگذاری شد
`,
  backupPartialMsg: (r) => `
⚠️ <b>نسخه پشتیبان ناقص فرستاده شد.</b>

${r.parts.filter(p => !p.error).length}/${r.total_parts} فایل رسید. ${r.message}
`,
  backupFailedMsg: (message) => `❌ پشتیبان‌گیری ناموفق بود: ${message}`,
  backupNotAdminMsg: () => `ℹ️ این دستور فقط برای مدیرهاست.`,

  supportNowMsg: (name, mood) => `💛 حال <b>${name}</b> الان: <b>${mood.name || ''}</b> ${mood.emoji || ''}

یک پیام کوتاه از طرف تو می‌تونه خیلی بهش دلگرمی بده.`,
  supportRepeatedMsg: (name, count, hours) => `💛 <b>${name}</b> این اواخر روزهای سختی داشته: ${count} حس سخت در ${hours} ساعت گذشته.

شاید خوب باشه یه حالی ازش بپرسی؟`,
  supportDaysMsg: (name, days) => `💛 <b>${name}</b> ${days} روز پشت سر هم حال سختی داشته.

یک پیام از طرف تو می‌تونه واقعاً کمکش کنه.`,
  supportSharedMsg: (name, mood) => `💛 <b>${name}</b> خواست بدونی الان حالش <b>${mood.name || ''}</b> ${mood.emoji || ''} است.

یک پیام کوتاه از طرف تو می‌تونه خیلی بهش دلگرمی بده.`,
  supportMessageButton: (name) => `💬 پیام به ${name}`,
  supportHugButton: () => `🤗 فرستادن بغل`,
  supportHugMsg: (name) => `🤗 <b>${name}</b> برات یک بغل فرستاد. به فکرته.`,
  supportHugSentMsg: () => `بغل فرستاده شد 💛`,
  supportHugNotAllowedMsg: () => `دیگه نمی‌تونی براش بغل بفرستی.`,
  supportInviteMsg: (name) => `🤝 <b>${name}</b> دوست داره تو دوست حمایتگرش باشی.

اگه ${name} حال سختی داشته باشه، MoodPal یک پیام کوتاه برات می‌فرسته تا حالش رو بپرسی. هر وقت خواستی از مینی‌اپ ← تنظیمات می‌تونی متوقفش کنی.`,
  supportAcceptButton: () => `💛 آره، هستم`,
  supportDeclineButton: () => `الان نه`,
  supportInviteAcceptedMsg: (name) => `💛 ممنونم. اگه ${name} حال سختی داشته باشه، MoodPal بهت خبر می‌ده.`,
  supportInviteDeclinedMsg: () => `👍 اشکالی نداره. چیزی بین شما دو نفر عوض نمی‌شه.`,
  supportInviteGoneMsg: () => `این دعوت دیگه معتبر نیست.`,
  supportAcceptedMsg: (name) => `💛 <b>${name}</b> قبول کرد دوست حمایتگرت باشه.`,
  supportDeclinedMsg: (name) => `<b>${name}</b> الان نمی‌تونه دوست حمایتگرت باشه. از مینی‌اپ ← تنظیمات می‌تونی کس دیگه‌ای رو انتخاب کنی.`,
  supportStoppedMsg: (name) => `<b>${name}</b> دیگه دوست حمایتگرت نیست.`,
  supportPromptMsg: () => `💛 دوست داری به چند تا از دوستانت بگی چه حسی داری؟
دوستانی رو که می‌خوای تیک بزن، بعد «خبر بده» رو بزن.`,
  supportNotifyButton: (n) => `💛 خبر بده به ${n} دوست`,
  supportSelectAllButton: (all) => (all ? 'برداشتن همه' : 'انتخاب همه'),
  supportNotifiedMsg: (names) => `💛 به ${names} خبر داده شد. مراقب خودت باش.`,
  supportTickFirstMsg: () => `اول دست‌کم یک دوست رو تیک بزن`,
  supportShareAllButton: (n) => `💛 اشتراک با همه (${n})`,
  supportSharedAllMsg: (names) => `💛 با ${names} به اشتراک گذاشته شد. مراقب خودت باش.`,
  supportSkipButton: () => `رد شدن`,
  supportSharedWithMsg: (names) => `💛 با ${names} به اشتراک گذاشته شد. می‌خوای به کس دیگه‌ای هم بگی؟`,
  supportPromptDoneMsg: () => `💛 باشه. مراقب خودت باش.`,
  supportTooOldToast: () => 'این حس برای اشتراک‌گذاری خیلی قدیمیه',
  supportCouldntShareToast: () => 'اشتراک‌گذاری نشد',
  supportCouldntReachToast: () => 'الان نشد بهش پیام برسونیم',
  supportCouldntReachAnyoneToast: () => 'الان نشد به کسی پیام برسونیم',
  supportReceiveOffToast: () => 'پیام‌های حمایتی رو خاموش کرده',
  supportAlreadySharedToast: () => 'قبلاً باهاش به اشتراک گذاشتی',
  supportNotifiedToast: (n) => `به ${n} دوست خبر داده شد 💛`,
  supportSharedCountToast: (n) => `با ${n} دوست به اشتراک گذاشته شد 💛`,
  supportSharedWithToast: (name) => `با ${name} به اشتراک گذاشته شد 💛`,


  personality: {
    disclaimer: '⚠️ <i>این یک پروفایل شخصیتی تقریبیه، نه تشخیص بالینی یا پزشکی.</i>',
    chooseTestTitle: '🧠 <b>تست‌های شخصیت</b>',
    chooseTestIntro: 'یک تست انتخاب کن. سؤال‌ها یکی‌یکی میان و هر وقت خواستی می‌تونی لغوش کنی.',
    testLine: (name, count, minutes) => `<b>${name}</b>: ${count} سؤال (حدود ${minutes} دقیقه)`,
    noTestsMsg: () => `🧠 الان هیچ تست شخصیتی در دسترس نیست.`,
    resumeOrRestartMsg: (name, answered, total) => `
🧠 تست <b>${name}</b> رو نیمه‌کاره گذاشتی (${answered}/${total} جواب داده شده).

از همون‌جا ادامه می‌دی یا از اول شروع می‌کنی؟
`,
    questionHeader: (name, n, total) => `🧠 <b>${name}</b> · سؤال ${n}/${total}`,
    cancelledMsg: () => `❌ تست لغو شد. هر وقت خواستی از 🧠 تست شخصیت دوباره شروع کن.`,
    cancelledToast: () => 'لغو شد',
    nothingToCancelMsg: () => `ℹ️ تست نیمه‌کاره‌ای نداری.`,
    sessionExpiredMsg: () => `ℹ️ این تست دیگه فعال نیست. از 🧠 تست شخصیت یک تست جدید شروع کن.`,
    somethingWrongToast: () => '❌ مشکلی پیش اومد. دوباره امتحان کن.',
    doneToast: () => '✅ تموم شد!',
    mbtiResultMsg: (type, c, url) => `<b>تو ${type} هستی: ${c.name}، ${c.title}!</b>
<i>${c.tagline}</i>

${c.description}

شخصیتت رو ببین و به اشتراک بذار: ${url}
<i>فقط برای سرگرمی، با الهام از MBTI. ارزیابی علمی یا بالینی نیست.</i>`,
    testCompletedMsg: (name) => `✅ <b>${name} تموم شد!</b> این پروفایل توست.\n\n💡 از 🧠 تست شخصیت یک تست دیگه بده تا پروفایلت کامل‌تر بشه.`,
    profileResetConfirmMsg: () => `
🗑 <b>پروفایل شخصیتت پاک بشه؟</b>

نتیجه تست‌ها، ترجیحاتی که یاد گرفته شده و تاریخچه مشاهدات پاک می‌شن. این کار برگشت‌پذیر نیست.
`,
    profileResetDoneMsg: () => `🗑 پروفایل شخصیتت پاک شد.`,
    profileResetCancelledMsg: () => `👍 پروفایلت دست‌نخورده موند.`,
    continueButton: '▶️ ادامه',
    startOverButton: '🔄 شروع دوباره',
    cancelButton: '❌ لغو',
    cancelTestButton: '❌ لغو تست',
    takeTestButton: '📝 انجام تست',
    retakeTestButton: '📝 انجام / تکرار تست',
    resetProfileButton: '🗑 پاک کردن پروفایل',
    resetYesButton: '✅ آره، پاک کن',
    keepItButton: '↩️ نگهش دار',
    profileTitle: '🧠 <b>شخصیت من</b>',
    profileEmpty: 'هنوز داده‌ای از شخصیتت نداریم. 🧠 تست شخصیت رو بده تا پروفایلت ساخته بشه.',
    profileTraitLine: (bar, name, level, pct, conf) => `${bar} ${name}: <i>${level}</i> (${pct}%، اطمینان ${conf}%)`,
    profileMoreTraits: (n) => `<i>${n} ویژگی دیگه با تست‌های بعدی و از گفت‌وگوهات کامل می‌شن.</i>`,
    profileDisclaimer: '⚠️ <i>این یک پروفایل شخصیتی تقریبیه که بر اساس یک پرسش‌نامه کوتاه و الگوهای گفت‌وگو ساخته شده. تشخیص بالینی یا پزشکی نیست.</i>',
    levels: { 'very low': 'خیلی کم', low: 'کم', 'medium-low': 'کمی پایین‌تر از متوسط', medium: 'متوسط', 'medium-high': 'کمی بالاتر از متوسط', high: 'زیاد', 'very high': 'خیلی زیاد', concise: 'کوتاه', balanced: 'متعادل', detailed: 'مفصل' },
  },
};

module.exports = fa;
