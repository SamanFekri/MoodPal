// Shared in-memory MongoDB for tests. Set MONGODB_TEST_URI to use a real server instead.
const mongoose = require('mongoose');

let mongod = null;

async function connect() {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }
  await mongoose.connect(uri);
}

async function clear() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
}

async function disconnect() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = null;
}

module.exports = { connect, clear, disconnect };
