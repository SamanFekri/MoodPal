// /language and the 🌐 Language button: pick the language MoodPal speaks to you (src/i18n).
// Changing it re-sends the menu keyboard in the new language and switches the commands shown in
// Telegram's "Menu" button for this chat.
const User = require('../models/user');
const i18n = require('../i18n');
const { common } = require('../constants');

const CALLBACK_PREFIX = 'lang_';
const CALLBACK_RE = new RegExp(`^${CALLBACK_PREFIX}(${i18n.LANGS.join('|')})$`);

// Commands shown in Telegram's "Menu" button (yearly video stays hidden on purpose)
const COMMAND_ORDER = [
  'start', 'set_mood', 'report', 'export', 'share', 'friends', 'personality_test', 'my_personality',
  'talk', 'end_talk', 'reminders', 'timezone', 'language', 'set_public', 'set_private',
  'set_openai_key', 'remove_openai_key', 'backup', 'help',
];
const botCommands = (lang) => {
  const t = i18n.forLang(lang);
  return COMMAND_ORDER.map(command => ({ command, description: t.commands[command] }));
};

// at startup: English for everyone, and Farsi / Russian for people whose Telegram app is in that language
async function registerCommands(telegram) {
  await telegram.setMyCommands(botCommands(i18n.DEFAULT_LANG));
  for (const lang of i18n.LANGS.filter(l => l !== i18n.DEFAULT_LANG)) {
    await telegram.setMyCommands(botCommands(lang), { language_code: lang });
  }
}

const pickerKeyboard = (current) => [
  i18n.LANGS.map(lang => {
    const t = i18n.forLang(lang);
    return { text: `${lang === current ? '✅ ' : ''}${t.flag} ${t.nativeName}`, callback_data: `${CALLBACK_PREFIX}${lang}` };
  }),
];

async function languageCommand(ctx) {
  try {
    await ctx.reply(i18n.forCtx(ctx).languageChooseMsg(), {
      reply_markup: { inline_keyboard: pickerKeyboard(i18n.normalize(ctx.user.language)) },
    });
  } catch (error) {
    console.error('Error in language command:', error);
  }
}

// save the language and tell the user's Telegram client (menu keyboard + command list)
async function setLanguage(ctx, lang) {
  await User.updateOne({ _id: ctx.user._id }, { language: lang });
  ctx.user.language = lang;
  if (ctx.chat?.type === 'private') {
    await ctx.telegram.setMyCommands(botCommands(lang), { scope: { type: 'chat', chat_id: ctx.chat.id } })
      .catch(err => console.error('setMyCommands for a chat failed:', err.message));
  }
}

async function languageCallback(ctx) {
  try {
    const lang = CALLBACK_RE.exec(ctx.callbackQuery?.data || '')?.[1];
    if (!lang) return ctx.answerCbQuery().catch(() => {});
    await setLanguage(ctx, lang);
    const t = i18n.forLang(lang);
    await ctx.answerCbQuery(t.languageChangedMsg()).catch(() => {});
    await ctx.editMessageText(t.languageChooseMsg(), { reply_markup: { inline_keyboard: pickerKeyboard(lang) } }).catch(() => {});
    // in Talk the talk keyboard stays; otherwise the main menu, now in the new language
    const inTalk = Boolean(await require('../chat/service').getActive(ctx.user._id));
    const keyboard = inTalk ? common.makeTalkKeyboard(ctx) : common.makeKeyboardMenu(ctx);
    await ctx.reply(t.languageChangedMsg(), { reply_markup: { keyboard, resize_keyboard: true } });
  } catch (error) {
    console.error('Error changing language:', error);
  }
}

module.exports = { languageCommand, languageCallback, setLanguage, botCommands, registerCommands, pickerKeyboard, CALLBACK_RE, COMMAND_ORDER };
