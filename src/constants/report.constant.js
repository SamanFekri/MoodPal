const en = require('../i18n/en');

// 7 / 30 / 90 days, labelled in the user's language (`t` from src/i18n)
const reportDaysKeyboard = (t = en) => [
  [7, 30, 90].map(days => ({ text: t.reportDaysButton(days), callback_data: `report_${days}` })),
];

module.exports = { reportDaysKeyboard, REPORT_DAYS_INLINE_KEYBOARD: reportDaysKeyboard(en) };
