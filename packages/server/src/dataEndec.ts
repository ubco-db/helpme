import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

export class DataEndec {
  constructor(private encryptionKey: string) {}

  /**
   * @description Encrypts data.
   * @param {String} data - Data to be encrypted
   */
  async encrypt(data: any): Promise<{ iv: string; data: string }> {
    const iv = Buffer.from(crypto.randomBytes(16));
    const cipher = crypto.createCipheriv(
      algorithm,
      Buffer.from(this.encryptionKey).slice(0, 32),
      iv,
    );
    let encrypted = cipher.update(JSON.stringify(data));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
      data: encrypted.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  /**
   * @description Decrypts data.
   * @param {String} data - Data to be decrypted
   * @param {String} iv - Encryption iv
   */
  async decrypt<T>(data: string, iv: string): Promise<T> {
    const iv_buf = Buffer.from(iv, 'hex');
    const encrypted_buf = Buffer.from(data, 'hex');
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(this.encryptionKey).slice(0, 32),
      iv_buf,
    );
    let decrypted = decipher.update(encrypted_buf);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  }
}
