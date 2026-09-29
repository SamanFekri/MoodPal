// /reminders, /timezone and their buttons (including the off button under a reminder message).
const reminders = require('../reminders/service');
const time = require('../reminders/time');

const TZ_PREFIX = 'tz:';
const TZ_RESET = 'tz_reset';

const fmt = (view) => {
  if (!view.service_enabled) return '⏰ Mood reminders are paused for everyone right now.';
  if (!view.enabled) return '🔕 Mood reminders are <b>off</b>.';
  return `⏰ Mood reminders are <b>on</b>: ${view.times.join(' and ')} (${view.timezone}).\nChange the times in the mini app → Settings, or your timezone with /timezone.`;
};
const buttons = (view) => ({
  inline_keyboard: [[view.enabled
    ? { text: '🔕 Turn off reminders', callback_data: reminders.CALLBACK_OFF }
    : { text: '⏰ Turn on reminders', callback_data: reminders.CALLBACK_ON }]],
});

const remindersCommand = async (ctx) => {
  const view = reminders.viewFor(ctx.user, await reminders.getSettings());
  await ctx.reply(fmt(view), { parse_mode: 'HTML', reply_markup: buttons(view) });
};

// the off button also sits under every reminder; there it only removes itself, keeping the mood picker
const toggleCallback = async (ctx) => {
  const on = ctx.callbackQuery?.data === reminders.CALLBACK_ON;
  const view = await reminders.updateForUser(ctx.user._id, { enabled: on });
  await ctx.answerCbQuery(on ? 'Reminders are on' : 'Reminders are off. Turn them back on with /reminders').catch(() => {});
  const markup = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard;
  const isReminder = Array.isArray(markup) && markup.length > 1;
  if (isReminder) {
    await ctx.editMessageReplyMarkup({ inline_keyboard: markup.filter(row => !row.some(b => b.callback_data === reminders.CALLBACK_OFF)) }).catch(() => {});
  } else {
    await ctx.editMessageText(fmt(view), { parse_mode: 'HTML', reply_markup: buttons(view) }).catch(() => {});
  }
};

// ---------- /timezone ----------
const zoneLabel = (tz) => { const d = time.describeTimezone(tz); return `${d.timezone} · ${d.offset} · ${d.local_time}`; };

const timezoneStatus = async (user) => {
  const tz = await reminders.timezoneView(user);
  const view = reminders.viewFor(user, await reminders.getSettings());
  const lines = [`🌍 Your timezone: <b>${tz.timezone}</b> (${tz.offset}). It's ${tz.local_time} there.`];
  if (!tz.is_set) lines.push(`That's the default; set your own so reminders arrive at your local time.`);
  if (view.enabled) lines.push(`⏰ Reminders: ${view.times.join(' and ')} in this timezone.`);
  return lines.join('\n');
};

const setAndConfirm = async (ctx, tz) => {
  const user = await reminders.setTimezone(ctx.user._id, tz);
  return `✅ Done.\n${await timezoneStatus(user)}`;
};

const timezoneCommand = async (ctx) => {
  const query = (ctx.message?.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!query) {
    const tz = await reminders.timezoneView(ctx.user);
    const text = `${await timezoneStatus(ctx.user)}\n\nTo change it, send /timezone with a city or an offset, e.g.\n<code>/timezone Tehran</code>\n<code>/timezone New York</code>\n<code>/timezone +3:30</code>\nor pick it in the mini app → Settings.`;
    const extra = { parse_mode: 'HTML' };
    if (tz.is_set) extra.reply_markup = { inline_keyboard: [[{ text: `↩︎ Back to default (${tz.default})`, callback_data: TZ_RESET }]] };
    return ctx.reply(text, extra);
  }
  const matches = time.searchTimezones(query, 8);
  if (!matches.length) {
    return ctx.reply(`I couldn't find a timezone for “${query.slice(0, 40)}”. Try a big city nearby (<code>/timezone Berlin</code>) or your UTC offset (<code>/timezone +2</code>).`, { parse_mode: 'HTML' });
  }
  if (matches.length === 1) return ctx.reply(await setAndConfirm(ctx, matches[0]), { parse_mode: 'HTML' });
  return ctx.reply('Which one is yours?', {
    reply_markup: { inline_keyboard: matches.map(z => [{ text: zoneLabel(z), callback_data: TZ_PREFIX + z }]) },
  });
};

const timezoneCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const tz = data === TZ_RESET ? null : data.slice(TZ_PREFIX.length);
  if (tz !== null && !time.isValidTimezone(tz)) return ctx.answerCbQuery('Unknown timezone').catch(() => {});
  const text = await setAndConfirm(ctx, tz);
  await ctx.answerCbQuery(tz ? `Timezone: ${tz}` : 'Back to the default timezone').catch(() => {});
  await ctx.editMessageText(text, { parse_mode: 'HTML' }).catch(() => ctx.reply(text, { parse_mode: 'HTML' }));
};

module.exports = { remindersCommand, toggleCallback, timezoneCommand, timezoneCallback, TZ_PREFIX, TZ_RESET };
