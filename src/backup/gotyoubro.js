// Client for the GotYouBro API (https://gotyoubro.samanfekri.me/api/docs).
// Only the four endpoints this app needs; `fetchImpl` is injectable for tests.
const DEFAULT_BASE_URL = 'https://gotyoubro.samanfekri.me';

class GotYouBroError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class GotYouBroClient {
  constructor({ token, baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch, timeoutMs = 120000 } = {}) {
    this.token = token;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async _request(path, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
    if (!this.token) throw new GotYouBroError('No GotYouBro token configured', { code: 'NO_TOKEN' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || this.timeoutMs);
    let res;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        body,
        headers: { Authorization: `Bearer ${this.token}`, ...headers },
        signal: controller.signal,
      });
    } catch (error) {
      throw new GotYouBroError(error.name === 'AbortError' ? 'Request timed out' : `Network error: ${error.message}`, { code: 'NETWORK' });
    } finally {
      clearTimeout(timer);
    }

    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.success === false) {
      const err = payload?.error || {};
      throw new GotYouBroError(err.message || `HTTP ${res.status}`, { status: res.status, code: err.code || null });
    }
    return payload?.data ?? payload;
  }

  // GET /api/v1/service — also the cheapest way to validate a token
  describeService() {
    return this._request('/api/v1/service', { timeoutMs: 20000 });
  }

  // POST /api/v1/health/heartbeat
  heartbeat() {
    return this._request('/api/v1/health/heartbeat', { method: 'POST', timeoutMs: 20000 });
  }

  // POST /api/v1/backups (multipart). `idempotencyKey` makes a retry replay the first upload.
  async uploadBackup(buffer, filename, { idempotencyKey = null, wait = false } = {}) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/zip' }), filename);
    const query = new URLSearchParams({ filename });
    if (wait) query.set('wait', 'true');
    return this._request(`/api/v1/backups?${query}`, {
      method: 'POST',
      body: form,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 128) } : {},
    });
  }

  // GET /api/v1/backups/{id}
  getBackup(id) {
    return this._request(`/api/v1/backups/${encodeURIComponent(id)}`, { timeoutMs: 20000 });
  }
}

module.exports = { GotYouBroClient, GotYouBroError, DEFAULT_BASE_URL };
