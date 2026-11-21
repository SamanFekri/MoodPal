// Русский (Russian). Same keys as en.js; anything missing falls back to English.
require('dotenv').config();
const { SERVER_BASE_URL } = require('../constants/server.constant');

const channel = () => process.env.MAIN_CHANNEL_USERNAME;
const botLink = () => `https://t.me/${process.env.BOT_USERNAME}`;
const formatBytes = (n) => {
  if (!n) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const progressBar = (percent, width = 12) => { const n = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width); return '▓'.repeat(n) + '░'.repeat(width - n); };
// Russian plural: 1 настроение, 2 настроения, 5 настроений
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};
const friends = (n) => plural(n, 'другу', 'друзьям', 'друзьям');

const ru = {
  code: 'ru',
  dir: 'ltr',
  nativeName: 'Русский',
  flag: '🇷🇺',
  aiLanguage: 'Russian',
  joinNames: (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names.at(-1)}` : names[0] || ''),
  listSep: ', ',
  someone: 'Кто-то',
  aFriend: 'друг',
  them: 'ему/ей',
  they: 'он(а)',
  their: 'Его/её',
  yourFriend: 'Твой друг',

  menu: {
    SET_MOOD: '🤩 Новое настроение',
    REPORT: '📊 Отчёт',
    EXPORT: '📥 Экспорт',
    SHARE: '🚀 Поделиться',
    VISIBILITY_PUBLIC: '👀 Сделать настроение публичным',
    VISIBILITY_PRIVATE: '👻 Сделать настроение приватным',
    PERSONALITY_TEST: '🧠 Тест личности',
    MY_PERSONALITY: '🧠 Моя личность',
    TALK: '💬 Поговорить',
    END_TALK: '🛑 Закончить разговор',
    BACKUP_NOW: '💾 Резервная копия',
    LANGUAGE: '🌐 Язык',
  },
  menuUpdatedMsg: () => '🆕 Меню обновлено.',

  commands: {
    start: 'Запустить бота',
    set_mood: 'Отметить текущее настроение',
    report: 'Отчёт о настроении за последние дни',
    export: 'Все настроения и заметки одним файлом',
    share: 'Поделиться настроением с другом',
    friends: 'На кого ты подписан(а) и кто подписан на тебя',
    personality_test: 'Пройти тест личности',
    my_personality: 'Посмотреть профиль личности',
    talk: 'Поговорить с ИИ-собеседником',
    end_talk: 'Закончить разговор',
    reminders: 'Включить или выключить напоминания',
    timezone: 'Указать часовой пояс (например, /timezone Moscow)',
    language: 'Сменить язык бота',
    set_public: 'Сделать настроение публичным (коды для сайта)',
    set_private: 'Сделать настроение приватным',
    set_openai_key: 'Добавить ключ OpenAI для ИИ-советов',
    remove_openai_key: 'Удалить ключ OpenAI',
    backup: 'Админы: сделать резервную копию базы',
    help: 'Список всех команд',
  },

  languageChooseMsg: () => '🌐 Выбери язык:',
  languageChangedMsg: () => '✅ Язык бота: русский.',

  moods: {
    happy: 'Радость', relaxed: 'Спокойствие', excited: 'Восторг', motivated: 'Мотивация', neutral: 'Нормально',
    confused: 'Растерянность', bored: 'Скука', uncertain: 'Неуверенность', disappointed: 'Разочарование', anxious: 'Тревога',
    angry: 'Злость', sad: 'Грусть', overwhelmed: 'Перегруз', overthinking: 'Много мыслей', tired: 'Усталость',
    nervous: 'Нервы', sick: 'Болею', naughty: 'Озорство',
  },
  moodGroups: { positive: 'Позитив', motivated: 'Мотивация', anxious: 'Тревога', negative: 'Негатив', drained: 'Без сил', calm: 'Спокойствие' },
  moodSavedToast: () => 'Настроение сохранено!',

  chooseMoodMsg: () => `Самое время рассказать, как ты! Выбери <b>настроение</b>, которое лучше всего описывает тебя сейчас:`,
  notImplementedMsg: () => `Эта функция пока не готова. Следи за обновлениями!`,
  helpMsg: () => `
Вот команды, которыми можно пользоваться:
/start - Запустить бота и получить приветствие
/help - Список доступных команд
/set_mood - Выбрать настроение из списка
/language - Сменить язык бота (English, فارسی, Русский)
/export - Все настроения и заметки (с днём и временем) одним файлом
/friends - Кто видит твоё настроение и чьё видишь ты, с возможностью отписаться
/reminders - Включить или выключить напоминания отметить настроение
/timezone - Указать часовой пояс, например /timezone Moscow или /timezone +3
/set_private - Сделать настроение приватным
/set_public - Сделать настроение публичным
/report - Получить отчёт о настроении
/share - Ссылка, по которой друзья смогут видеть твоё настроение
/personality_test - Пройти тест личности
/my_personality - Посмотреть профиль личности
/talk - Поговорить с ИИ-собеседником (нужен твой ключ OpenAI)
/end_talk - Закончить разговор и вернуться к заметкам
/backup - (админы) сделать резервную копию базы сейчас
/set_openai_key - Добавить свой ключ OpenAI для ИИ-советов в недельном отчёте
/remove_openai_key - Удалить ключ OpenAI и выключить ИИ-советы
`,
  welocmeMsg: (name) => `
Привет, ${name}!
Добро пожаловать в Mood Pal, твой личный дневник настроения.

Отмечай своё <i>настроение</i> и оставайся на связи со своими <i>чувствами</i>.
Выбирай из множества настроений то, что отражает твоё состояние прямо сейчас.

Mood Pal показывает, как твоё <i>настроение</i> меняется со временем, и помогает лучше понимать своё <i>эмоциональное состояние</i>.

Подпишись на наш канал, чтобы каждый день получать напоминание отметить настроение
@${channel()}

${ru.helpMsg()}
`,
  joinChannelMsg: () => '🤩 Подпишись, пожалуйста, на канал MoodPals, чтобы мы могли напоминать тебе отметить настроение.',
  joinButton: () => '👉 Подписаться',

  noMoodMsg: () => `😔 Ты ещё не отметил(а) настроение. Сделай это через /set_mood. 🤩`,
  addNoteMsg: () => `📝 Теперь можно добавить заметку к настроению. Напиши её ниже:`,
  noteSavedMsg: () => `✅ Заметка к настроению сохранена!`,

  moodPrivateMsg: () => `👻 Теперь твоё настроение приватное`,
  moodPublicMsg: (id) => `
👀 Теперь твоё настроение публичное.

👨🏻‍💻 Добавь это на свой сайт, чтобы показывать своё настроение.

✅ Анимированное настроение WebP:
<code>&lt;img src="${SERVER_BASE_URL}/user/${id}/mood/animated" /&gt;</code>

✅ Анимированное настроение TGS:
Подключи скрипт перед использованием тега mood-pal
<code>&lt;script src="${SERVER_BASE_URL}/public/lib/tgs-player.js"&gt;&lt;/script&gt;</code>

Добавь это в body страницы
<code>&lt;mood-pal src="${SERVER_BASE_URL}/user/${id}/mood/tgs" &gt;&lt;/mood-pal&gt;</code>

✅ Настроение эмодзи:
<code>${SERVER_BASE_URL}/user/${id}/mood/emoji</code>
`,

  showReportMsg: (user, days) => `
👻 Привет, ${user.first_name}!
📊 Вот твой отчёт о настроении за последние ${days} ${plural(days, 'день', 'дня', 'дней')}`,
  reportMsg: () => `
📆 Выбери период для отчёта о настроении:
`,
  reportDaysButton: (days) => `${days} ${plural(days, 'день', 'дня', 'дней')}`,
  reportSentToast: () => '📊 Отчёт отправлен!',
  reportFailedToast: () => '❌ Не получилось сделать отчёт. Попробуй ещё раз.',

  createShareLinkMsg: (user) => `
👨🏻‍💻 Перешли это сообщение друзьям, чтобы они видели твоё настроение:

👀 Нажми, чтобы увидеть <a href="${botLink()}?start=sm-${user._id}">настроение: ${user.first_name}</a>

🔗 <code>${botLink()}?start=sm-${user._id}</code>
`,
  askForShareMoodMsg: (follower) => `👀 ${follower.first_name} хочет видеть твоё настроение.`,
  waitingForShareMsg: (follower) => `👀 Ждём, пока ${follower.first_name} разрешит тебе видеть своё настроение.`,
  shareAllowedMsg: (follower) => `👀 Теперь ${follower.first_name} видит твоё настроение.`,
  sharePermissionGrantedMsg: (followed) => `✅ ${followed.first_name} разрешает тебе видеть своё настроение.`,
  hasAlreadySharedMsg: (followed) => `🤩 ${followed.first_name} уже делится с тобой настроением.`,
  followBackAskMsg: (follower) => `Хочешь тоже видеть настроение, которое отмечает ${follower.first_name}?`,
  followBackGiveMsg: (followed) => `Разрешить ${followed.first_name} тоже видеть твоё настроение?`,
  alreadySeesYouMsg: (other) => `🤝 ${other.first_name} уже видит твоё настроение.`,
  sharedBackMsg: (followed) => `🤝 Готово. Теперь ${followed.first_name} тоже видит твоё настроение.`,
  sharedBackNoticeMsg: (follower) => `🤝 ${follower.first_name} тоже делится с тобой настроением. Теперь вы видите настроение друг друга.`,
  rejectShareMsg: (follower) => `❌ Ты отклонил(а) запрос: ${follower.first_name} не увидит твоё настроение.`,
  followBackAskButton: (name) => `👀 Попросить доступ: ${name}`,
  followBackGiveButton: (name) => `🤝 Пусть ${name} тоже видит`,
  viewUserButton: (name) => `👤 Профиль: ${name}`,
  allowButton: () => '✅ Разрешить',
  rejectButton: () => '❌ Отклонить',

  friendsNoneMsg: () => '🫂 Ты пока ни с кем не делишься настроением.\nНажми 🚀 Поделиться и отправь ссылку другу.',
  friendsTitle: () => '🫂 <b>Твои друзья</b>',
  friendsYouSee: (list) => `👀 <b>Ты видишь настроение:</b> ${list}`,
  friendsSeeYou: (list) => `🙋 <b>Твоё настроение видят:</b> ${list}`,
  nobody: () => 'никто',
  friendsHint: () => 'Нажми, чтобы изменить. Никто не получит уведомления.',
  friendsUnfollowButton: (name) => `🚫 Отписаться: ${name}`,
  friendsBothButton: () => '💔 Оба',
  friendsHideButton: (name) => `🙈 Скрыть моё настроение: ${name}`,
  friendsUnfollowedToast: (name) => `Ты больше не видишь настроение: ${name}`,
  friendsRemovedToast: (name) => `${name} больше не видит твоё настроение`,
  friendsBothToast: (name) => `Вы с ${name} больше не видите настроение друг друга`,

  exportNoMoodsMsg: () => 'Ты ещё не отмечал(а) настроение. Выбери его через 🤩 Новое настроение, и оно появится в экспорте.',
  exportTooSoonMsg: (s) => `Файл уже в пути. Повторить экспорт можно через ${s} с.`,
  exportFailedMsg: () => 'Извини, сейчас не получилось сделать экспорт. Попробуй через минуту.',
  exportCaption: (count, tz) => `📥 Твой дневник настроения: ${count} ${plural(count, 'запись', 'записи', 'записей')} с заметками, время по ${tz}. Открывается в Excel, Numbers или Google Таблицах.`,
  exportColumns: ['Дата', 'День недели', 'Время', 'Часовой пояс', 'Настроение', 'Заметка'],

  reminderCheckInMsg: () => `⏰ <b>Как настроение?</b>\nКак ты себя чувствуешь прямо сейчас? Выбери подходящее настроение:`,
  remindersPausedMsg: () => '⏰ Напоминания сейчас приостановлены для всех.',
  remindersOffMsg: () => '🔕 Напоминания о настроении <b>выключены</b>.',
  remindersOnMsg: (times, tz) => `⏰ Напоминания о настроении <b>включены</b>: ${times} (${tz}).\nВремя можно поменять в мини-приложении → Настройки, а часовой пояс через /timezone.`,
  remindersOffButton: () => '🔕 Выключить напоминания',
  remindersOnButton: () => '⏰ Включить напоминания',
  remindersOnToast: () => 'Напоминания включены',
  remindersOffToast: () => 'Напоминания выключены. Включить снова: /reminders',
  tzStatusMsg: (tz, offset, localTime) => `🌍 Твой часовой пояс: <b>${tz}</b> (${offset}). Там сейчас ${localTime}.`,
  tzDefaultHint: () => `Это пояс по умолчанию; укажи свой, чтобы напоминания приходили по твоему местному времени.`,
  tzRemindersLine: (times) => `⏰ Напоминания: ${times} по этому поясу.`,
  tzDoneMsg: () => '✅ Готово.',
  tzHowToMsg: () => `Чтобы поменять, отправь /timezone с городом или смещением, например\n<code>/timezone Moscow</code>\n<code>/timezone New York</code>\n<code>/timezone +3</code>\nили выбери его в мини-приложении → Настройки.`,
  tzBackToDefaultButton: (def) => `↩︎ Вернуть по умолчанию (${def})`,
  tzNotFoundMsg: (q) => `Не нашёл часовой пояс для «${q}». Попробуй крупный город рядом (<code>/timezone Moscow</code>) или смещение от UTC (<code>/timezone +3</code>).`,
  tzWhichOneMsg: () => 'Какой из них твой?',
  tzUnknownToast: () => 'Неизвестный часовой пояс',
  tzSetToast: (tz) => `Часовой пояс: ${tz}`,
  tzResetToast: () => 'Вернули часовой пояс по умолчанию',

  askOpenAIKeyMsg: () => `
🧠 <b>ИИ-советы по настроению</b> работают на <i>твоём собственном</i> ключе OpenAI, так что никто другой не тратит твои кредиты.

🔑 Ответь на это сообщение своим ключом OpenAI API (он начинается с <code>sk-</code>).
Создать ключ можно тут: https://platform.openai.com/api-keys

🔒 Ключ хранится в зашифрованном виде и используется только для анализа <b>твоих</b> недельных настроений. Сообщение с ключом удалится сразу после сохранения.

Удалить ключ можно в любой момент: /remove_openai_key
`,
  openAIKeyInvalidFormatMsg: () => `❌ Это не похоже на ключ OpenAI. Он должен начинаться с <code>sk-</code>. Попробуй /set_openai_key ещё раз.`,
  openAIKeyVerifyingMsg: () => `⏳ Проверяю ключ в OpenAI…`,
  openAIKeySavedMsg: () => `✅ Ключ OpenAI проверен и сохранён. Теперь к недельному отчёту будут приходить ИИ-советы. 🧠`,
  openAIKeyRejectedMsg: () => `❌ OpenAI не принял этот ключ. Проверь его и попробуй /set_openai_key ещё раз.`,
  openAIKeyErrorMsg: () => `⚠️ Сейчас не получается связаться с OpenAI, чтобы проверить ключ. Попробуй чуть позже.`,
  openAIKeyRemovedMsg: () => `🗑 Ключ OpenAI удалён. ИИ-советы выключены.`,
  openAIKeyNotSetMsg: () => `ℹ️ У тебя нет сохранённого ключа OpenAI. Добавить: /set_openai_key`,
  openAIKeyStoppedWorkingMsg: () => `⚠️ OpenAI не принял твой сохранённый ключ, поэтому ИИ-совет на этой неделе пропущен. Обнови ключ через /set_openai_key.`,

  TALK_DISCLAIMER: `🤖 <b>Сначала прочитай</b>
• Ты общаешься с <b>ИИ-ботом</b>, а не с человеком и не с психотерапевтом. Он старается отвечать как поддерживающий психолог, но <b>может ошибаться</b>.
• Это <b>не</b> терапия, не медицинский совет и не диагноз. Если ты в опасности или думаешь о том, чтобы навредить себе, сразу звони в местную экстренную службу или на линию психологической помощи.
• Работает на <b>твоём ключе OpenAI</b>, если ты его добавил(а) (/set_openai_key), иначе на общем ИИ MoodPal. Твои сообщения отправляются в этот ИИ-сервис и хранятся здесь, чтобы разговор имел контекст.`,
  talkIntroMsg: (name) => `
💬 <b>Давай поговорим${name ? `, ${name}` : ''}.</b>

${ru.TALK_DISCLAIMER}

Когда будешь готов(а), расскажи, что у тебя на душе. Нажми 🛑 <b>Закончить разговор</b> (или /end_talk) в любой момент. После этого твои сообщения снова будут сохраняться как заметки к настроению.
`,
  talkNeedsKeyMsg: () => `
💬 <b>Разговор</b> работает на твоём ключе OpenAI, так что никто другой не платит за твои беседы.

🔑 Добавь ключ через /set_openai_key, потом снова нажми 💬 Поговорить.

${ru.TALK_DISCLAIMER}
`,
  talkEndedMsg: () => `🛑 Разговор закончен. Береги себя. 💛

Теперь твои сообщения снова сохраняются как заметки к настроению.`,
  talkNotActiveMsg: () => `ℹ️ Сейчас разговор не идёт. Нажми 💬 Поговорить, чтобы начать.`,
  talkErrorMsg: () => `⚠️ Сейчас не получилось ответить. Попробуй ещё раз чуть позже или нажми /end_talk, чтобы закончить.`,
  talkModelUnavailableMsg: (model) => `⚠️ Твой аккаунт OpenAI не может использовать модель <b>${model}</b>. Выбери другую в мини-приложении → Настройки → Модель, потом снова нажми 💬 Поговорить.`,
  talkKeyRejectedMsg: () => `❌ OpenAI не принял твой ключ, поэтому я не могу ответить. Обнови его через /set_openai_key и снова нажми 💬 Поговорить.`,
  talkSafetyFooterMsg: () => `
🛟 <b>Если ты можешь быть в опасности, не жди ответа от бота.</b> Прямо сейчас обратись к тому, кому доверяешь, на линию психологической помощи или в экстренную службу. Я ИИ и не могу тебя защитить. Живой человек может.`,
  talkAboutNoteMsg: () => `💬 Хочешь поговорить об этом?`,
  talkAboutButton: () => '💬 Поговорить об этом',
  talkSharedNoteMsg: (provider, left, limit) => `🎁 Ты на бесплатном ИИ MoodPal (${provider}): сегодня осталось <b>${left} из ${limit}</b> сообщений. Сообщения уходят в ${provider}. Для безлимитного разговора добавь свой ключ OpenAI через /set_openai_key.`,
  talkLimitMsg: (limit) => `⏳ Бесплатные сообщения на сегодня закончились (${limit}). Они обновятся в полночь, или добавь свой ключ OpenAI через /set_openai_key для безлимитного разговора. 💛`,
  talkDailyCapMsg: () => `⏳ Бесплатный ИИ MoodPal на сегодня перегружен. Попробуй завтра или добавь свой ключ OpenAI через /set_openai_key. 💛`,
  talkSharedUnavailableMsg: () => `⚠️ Бесплатный ИИ MoodPal сейчас не работает. Попробуй позже или добавь свой ключ OpenAI через /set_openai_key.`,
  talkReminderMsg: () => `<i>🤖 Напоминание: я ИИ, а не психотерапевт, и могу ошибаться.</i>`,
  talkFallbackReply: () => 'Расскажи чуть подробнее, что происходит?',
  insightFallback: () => 'Извини, сейчас не получилось проанализировать твоё настроение.',

  backupStartedMsg: () => `💾 Собираю резервную копию и загружаю…`,
  backupDoneMsg: (r) => `
✅ <b>Резервная копия отправлена.</b>

📦 Файлов: ${r.total_parts} · документов: ${r.total_documents}
🗂 Загружено ${formatBytes(r.bytes)}
`,
  backupPartialMsg: (r) => `
⚠️ <b>Резервная копия отправлена частично.</b>

Дошло файлов: ${r.parts.filter(p => !p.error).length}/${r.total_parts}. ${r.message}
`,
  backupFailedMsg: (message) => `❌ Не удалось сделать резервную копию: ${message}`,
  backupNotAdminMsg: () => `ℹ️ Эта команда только для админов.`,

  supportNowMsg: (name, mood) => `💛 У <b>${name}</b> сейчас настроение: <b>${String(mood.name || '').toLowerCase()}</b> ${mood.emoji || ''}

Короткое сообщение от тебя может очень много значить.`,
  supportRepeatedMsg: (name, count, hours) => `💛 У <b>${name}</b> непростое время: тяжёлых настроений за последние ${hours} ч: ${count}.

Может, стоит написать и спросить, как дела?`,
  supportDaysMsg: (name, days) => `💛 У <b>${name}</b> уже ${days} ${plural(days, 'тяжёлый день', 'тяжёлых дня', 'тяжёлых дней')} подряд.

Сообщение от тебя может очень помочь.`,
  supportSharedMsg: (name, mood) => `💛 <b>${name}</b> хочет, чтобы ты знал(а): сейчас настроение <b>${String(mood.name || '').toLowerCase()}</b> ${mood.emoji || ''}

Короткое сообщение от тебя может очень много значить.`,
  supportMessageButton: (name) => `💬 Написать: ${name}`,
  supportHugButton: () => `🤗 Обнять`,
  supportHugMsg: (name) => `🤗 <b>${name}</b> обнимает тебя и думает о тебе.`,
  supportHugSentMsg: () => `Объятие отправлено 💛`,
  supportHugNotAllowedMsg: () => `Ты больше не можешь отправлять объятия этому человеку.`,
  supportInviteMsg: (name) => `🤝 <b>${name}</b> хочет, чтобы ты стал(а) другом поддержки.

Если у ${name} будет тяжёлое время, MoodPal пришлёт тебе короткое сообщение, чтобы ты мог(ла) поддержать. Отключить можно в любой момент в мини-приложении → Настройки.`,
  supportAcceptButton: () => `💛 Да, я с тобой`,
  supportDeclineButton: () => `Не сейчас`,
  supportInviteAcceptedMsg: (name) => `💛 Спасибо. MoodPal сообщит тебе, если у ${name} будет тяжёлое время.`,
  supportInviteDeclinedMsg: () => `👍 Ничего страшного. Между вами ничего не меняется.`,
  supportInviteGoneMsg: () => `Это приглашение больше не действует.`,
  supportAcceptedMsg: (name) => `💛 <b>${name}</b> теперь твой друг поддержки.`,
  supportDeclinedMsg: (name) => `<b>${name}</b> сейчас не может быть другом поддержки. Выбрать кого-то другого можно в мини-приложении → Настройки.`,
  supportStoppedMsg: (name) => `<b>${name}</b> больше не твой друг поддержки.`,
  supportPromptMsg: () => `💛 Хочешь рассказать друзьям, как ты себя чувствуешь?
Отметь нужных друзей и нажми «Сообщить».`,
  supportNotifyButton: (n) => `💛 Сообщить ${n} ${friends(n)}`,
  supportSelectAllButton: (all) => (all ? 'Снять все' : 'Выбрать всех'),
  supportNotifiedMsg: (names) => `💛 Сообщили: ${names}. Береги себя.`,
  supportTickFirstMsg: () => `Сначала отметь хотя бы одного друга`,
  supportShareAllButton: (n) => `💛 Поделиться со всеми (${n})`,
  supportSharedAllMsg: (names) => `💛 Поделились с: ${names}. Береги себя.`,
  supportSkipButton: () => `Пропустить`,
  supportSharedWithMsg: (names) => `💛 Поделились с: ${names}. Рассказать кому-то ещё?`,
  supportPromptDoneMsg: () => `💛 Хорошо. Береги себя.`,
  supportTooOldToast: () => 'Это настроение уже слишком старое, чтобы делиться',
  supportCouldntShareToast: () => 'Не получилось поделиться',
  supportCouldntReachToast: () => 'Сейчас не получается до него/неё достучаться',
  supportCouldntReachAnyoneToast: () => 'Сейчас не получается ни до кого достучаться',
  supportReceiveOffToast: () => 'Этот человек выключил сообщения поддержки',
  supportAlreadySharedToast: () => 'Уже поделились',
  supportNotifiedToast: (n) => `Сообщили ${n} ${friends(n)} 💛`,
  supportSharedCountToast: (n) => `Поделились с ${n} ${plural(n, 'другом', 'друзьями', 'друзьями')} 💛`,
  supportSharedWithToast: (name) => `Поделились с: ${name} 💛`,


  personality: {
    disclaimer: '⚠️ <i>Это приблизительный профиль личности, а не клинический или медицинский диагноз.</i>',
    chooseTestTitle: '🧠 <b>Тесты личности</b>',
    chooseTestIntro: 'Выбери тест. Вопросы приходят по одному, отменить можно в любой момент.',
    testLine: (name, count, minutes) => `<b>${name}</b>: ${count} ${plural(count, 'вопрос', 'вопроса', 'вопросов')} (~${minutes} мин)`,
    noTestsMsg: () => `🧠 Сейчас нет доступных тестов личности.`,
    resumeOrRestartMsg: (name, answered, total) => `
🧠 У тебя есть незаконченный тест <b>${name}</b> (отвечено ${answered}/${total}).

Продолжить с того же места или начать заново?
`,
    questionHeader: (name, n, total) => `🧠 <b>${name}</b> · вопрос ${n}/${total}`,
    cancelledMsg: () => `❌ Тест отменён. Начать снова можно в любой момент через 🧠 Тест личности.`,
    cancelledToast: () => 'Отменено',
    nothingToCancelMsg: () => `ℹ️ У тебя нет начатого теста.`,
    sessionExpiredMsg: () => `ℹ️ Этот тест уже неактивен. Начни новый через 🧠 Тест личности.`,
    somethingWrongToast: () => '❌ Что-то пошло не так. Попробуй ещё раз.',
    doneToast: () => '✅ Готово!',
    mbtiResultMsg: (type, c, url) => `<b>Ты ${type}: ${c.name}, ${c.title}!</b>
<i>${c.tagline}</i>

${c.description}

Посмотри своего персонажа и поделись им: ${url}
<i>Просто для развлечения, по мотивам MBTI. Это не научная и не клиническая оценка.</i>`,
    testCompletedMsg: (name) => `✅ <b>Тест «${name}» пройден!</b> Вот твой профиль.\n\n💡 Пройди ещё один тест в 🧠 Тест личности, чтобы дополнить его.`,
    profileResetConfirmMsg: () => `
🗑 <b>Сбросить профиль личности?</b>

Будут удалены результаты тестов, выученные предпочтения и история наблюдений. Отменить это нельзя.
`,
    profileResetDoneMsg: () => `🗑 Профиль личности сброшен.`,
    profileResetCancelledMsg: () => `👍 Профиль сохранён.`,
    continueButton: '▶️ Продолжить',
    startOverButton: '🔄 Начать заново',
    cancelButton: '❌ Отмена',
    cancelTestButton: '❌ Отменить тест',
    takeTestButton: '📝 Пройти тест',
    retakeTestButton: '📝 Пройти / перепройти тест',
    resetProfileButton: '🗑 Сбросить профиль',
    resetYesButton: '✅ Да, сбросить',
    keepItButton: '↩️ Оставить',
    profileTitle: '🧠 <b>Моя личность</b>',
    profileEmpty: 'Данных о личности пока нет. Пройди 🧠 Тест личности, чтобы собрать профиль.',
    profileTraitLine: (bar, name, level, pct, conf) => `${bar} ${name}: <i>${level}</i> (${pct}%, уверенность ${conf}%)`,
    profileMoreTraits: (n) => `<i>Ещё черт: ${n}. Они заполнятся по мере прохождения других тестов и из твоих разговоров.</i>`,
    profileDisclaimer: '⚠️ <i>Это приблизительный профиль личности на основе короткого опросника и стиля общения. Это не клинический и не медицинский диагноз.</i>',
    levels: { 'very low': 'очень низкий', low: 'низкий', 'medium-low': 'ниже среднего', medium: 'средний', 'medium-high': 'выше среднего', high: 'высокий', 'very high': 'очень высокий', concise: 'кратко', balanced: 'сбалансированно', detailed: 'подробно' },
  },
};

module.exports = ru;
