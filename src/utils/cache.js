class Cache {
  constructor(ttl = 3600000) { // 1 hour in milliseconds
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    const expiryTime = Date.now() + this.ttl;
    this.cache.set(key, {
      value,
      expiryTime
    });
    return value;
  }

  get(key) {
    const data = this.cache.get(key);
    if (!data) return null;

    if (Date.now() > data.expiryTime) {
      this.cache.delete(key);
      return null;
    }

    return data.value;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Clean expired entries periodically
  startCleanup(interval = 600000) { // Clean every 10 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.cache.entries()) {
        if (now > data.expiryTime) {
          this.cache.delete(key);
        }
      }
    }, interval);
  }
}

module.exports = Cache; 