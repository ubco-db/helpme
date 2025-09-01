import crypto from 'crypto';

export class DataEndec {
  constructor(private encryptionKey: string) {}

  /**
   * @description Encrypts data.
   * @param {String} data - Data to be encrypted
   */
  async encrypt(data: any): Promise<{ iv: string; data: string }> {
    const hash = crypto.createHash('sha256');
    hash.update(this.encryptionKey);
    const key = Uint8Array.prototype.slice.call(hash.digest(), 0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
  }

  /**
   * @description Decrypts data.
   * @param {String} data - Data to be decrypted
   * @param {String} iv - Encryption iv
   */
  async decrypt<T>(data: string, iv: string): Promise<T> {
    const hash = crypto.createHash('sha256');
    hash.update(this.encryptionKey);
    const key = Uint8Array.prototype.slice.call(hash.digest(), 0, 32);
    const newIv = Buffer.from(iv, 'hex');
    const encryptedText = Buffer.from(data, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key),
      newIv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  }
}
