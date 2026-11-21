// English bot messages. The texts live in src/i18n (one dictionary per language); this keeps the
// old `msgs.someMsg()` import working and always speaks English. For a user, use
// require('../i18n').forCtx(ctx) / .forUser(user) so they get their own language.
module.exports = require('../i18n/en');
