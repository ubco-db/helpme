export default class MockRedisClient {
  private store: Record<string, any> = {};

  async get(key: string) {
    return this.store[key] ?? null;
  }

  async set(key: string, value: any) {
    this.store[key] = value;
    return 'OK';
  }

  async del(key: string) {
    delete this.store[key];
    return 1;
  }

  async lpush(key: string, ...values: string[]) {
    this.store[key] = [...(this.store[key] ?? []), ...values];
    return this.store[key].length;
  }

  async lrange(key: string, start: number, end: number) {
    return (this.store[key] ?? []).slice(start, end + 1);
  }

  async expire(key: string, seconds: number) {
    // Simulate expiration, or do nothing in mock
    return 1;
  }
}
