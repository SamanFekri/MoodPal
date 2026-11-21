// /reminders, /timezone and their buttons (including the off button under a reminder message).
const reminders = require('../reminders/service');
const time = require('../reminders/time');
const i18n = require('../i18n');

const TZ_PREFIX = 'tz:';
const TZ_RESET = 'tz_reset';

// `t`: the user's dictionary (src/i18n)
const fmt = (view, t) => {
  if (!view.service_enabled) return t.remindersPausedMsg();
  if (!view.enabled) return t.remindersOffMsg();
  return t.remindersOnMsg(t.joinNames(view.times), view.timezone);
};
const buttons = (view, t) => ({
  inline_keyboard: [[view.enabled
    ? { text: t.remindersOffButton(), callback_data: reminders.CALLBACK_OFF }
    : { text: t.remindersOnButton(), callback_data: reminders.CALLBACK_ON }]],
});

const remindersCommand = async (ctx) => {
  const t = i18n.forCtx(ctx);
  const view = reminders.viewFor(ctx.user, await reminders.getSettings());
  await ctx.reply(fmt(view, t), { parse_mode: 'HTML', reply_markup: buttons(view, t) });
};

// the off button also sits under every reminder; there it only removes itself, keeping the mood picker
const toggleCallback = async (ctx) => {
  const t = i18n.forCtx(ctx);
  const on = ctx.callbackQuery?.data === reminders.CALLBACK_ON;
  const view = await reminders.updateForUser(ctx.user._id, { enabled: on });
  await ctx.answerCbQuery(on ? t.remindersOnToast() : t.remindersOffToast()).catch(() => {});
  const markup = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard;
  const isReminder = Array.isArray(markup) && markup.length > 1;
  if (isReminder) {
    await ctx.editMessageReplyMarkup({ inline_keyboard: markup.filter(row => !row.some(b => b.callback_data === reminders.CALLBACK_OFF)) }).catch(() => {});
  } else {
    await ctx.editMessageText(fmt(view, t), { parse_mode: 'HTML', reply_markup: buttons(view, t) }).catch(() => {});
  }
};

// ---------- /timezone ----------
const zoneLabel = (tz) => { const d = time.describeTimezone(tz); return `${d.timezone} · ${d.offset} · ${d.local_time}`; };

const timezoneStatus = async (user, t = i18n.forUser(user)) => {
  const tz = await reminders.timezoneView(user);
  const view = reminders.viewFor(user, await reminders.getSettings());
  const lines = [t.tzStatusMsg(tz.timezone, tz.offset, tz.local_time)];
  if (!tz.is_set) lines.push(t.tzDefaultHint());
  if (view.enabled) lines.push(t.tzRemindersLine(t.joinNames(view.times)));
  return lines.join('\n');
};

const setAndConfirm = async (ctx, tz) => {
  const t = i18n.forCtx(ctx);
  const user = await reminders.setTimezone(ctx.user._id, tz);
  return `${t.tzDoneMsg()}\n${await timezoneStatus(user, t)}`;
};

const timezoneCommand = async (ctx) => {
  const t = i18n.forCtx(ctx);
  const query = (ctx.message?.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!query) {
    const tz = await reminders.timezoneView(ctx.user);
    const text = `${await timezoneStatus(ctx.user, t)}\n\n${t.tzHowToMsg()}`;
    const extra = { parse_mode: 'HTML' };
    if (tz.is_set) extra.reply_markup = { inline_keyboard: [[{ text: t.tzBackToDefaultButton(tz.default), callback_data: TZ_RESET }]] };
    return ctx.reply(text, extra);
  }
  const matches = time.searchTimezones(query, 8);
  if (!matches.length) {
    return ctx.reply(t.tzNotFoundMsg(query.slice(0, 40)), { parse_mode: 'HTML' });
  }
  if (matches.length === 1) return ctx.reply(await setAndConfirm(ctx, matches[0]), { parse_mode: 'HTML' });
  return ctx.reply(t.tzWhichOneMsg(), {
    reply_markup: { inline_keyboard: matches.map(z => [{ text: zoneLabel(z), callback_data: TZ_PREFIX + z }]) },
  });
};

const timezoneCallback = async (ctx) => {
  const t = i18n.forCtx(ctx);
  const data = ctx.callbackQuery?.data || '';
  const tz = data === TZ_RESET ? null : data.slice(TZ_PREFIX.length);
  if (tz !== null && !time.isValidTimezone(tz)) return ctx.answerCbQuery(t.tzUnknownToast()).catch(() => {});
  const text = await setAndConfirm(ctx, tz);
  await ctx.answerCbQuery(tz ? t.tzSetToast(tz) : t.tzResetToast()).catch(() => {});
  await ctx.editMessageText(text, { parse_mode: 'HTML' }).catch(() => ctx.reply(text, { parse_mode: 'HTML' }));
};

module.exports = { remindersCommand, toggleCallback, timezoneCommand, timezoneCallback, TZ_PREFIX, TZ_RESET };
