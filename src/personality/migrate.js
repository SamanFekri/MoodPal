// Idempotent, versioned seed of the personality catalog.
// Run at bot start-up (ensurePersonalityCatalog) or manually: `yarn migrate:personality`.
const PersonalityTrait = require('../models/personality_trait');
const PersonalityTest = require('../models/personality_test');
const PersonalityTestQuestion = require('../models/personality_test_question');
const seed = require('./catalog.seed');

// Insert missing docs; only overwrite existing ones when the seed version is newer,
// so operators can tune traits/tests in the database without being reset.
async function upsertVersioned(Model, docs, keyFields) {
  let inserted = 0, updated = 0, kept = 0;
  for (const doc of docs) {
    const filter = Object.fromEntries(keyFields.map(f => [f, doc[f]]));
    const existing = await Model.findOne(filter).select('version').lean();
    if (!existing) {
      await Model.create(doc);
      inserted++;
    } else if ((existing.version || 0) < (doc.version || 1)) {
      await Model.updateOne(filter, { $set: doc });
      updated++;
    } else {
      kept++;
    }
  }
  return { inserted, updated, kept };
}

async function ensurePersonalityCatalog({ log = console.log } = {}) {
  const traits = await upsertVersioned(PersonalityTrait, seed.TRAITS, ['key']);
  const tests = await upsertVersioned(PersonalityTest, seed.TESTS, ['key']);
  const questions = await upsertVersioned(PersonalityTestQuestion, seed.QUESTIONS, ['test_key', 'order']);
  const fmt = (r) => `+${r.inserted} ~${r.updated} =${r.kept}`;
  log(`🧠 Personality catalog: traits ${fmt(traits)}, tests ${fmt(tests)}, questions ${fmt(questions)}`);
  return { traits, tests, questions };
}

module.exports = { ensurePersonalityCatalog, upsertVersioned };

// CLI: node src/personality/migrate.js
if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => ensurePersonalityCatalog())
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => { console.error('❌ Personality migration failed:', error); process.exit(1); });
}
