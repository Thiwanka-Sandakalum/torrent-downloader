import * as crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-cbc';
  private key: Buffer;
  private iv: Buffer;

  constructor() {
    // Use environment variables for secure key management
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('Encryption key not configured');
    
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    this.iv = crypto.randomBytes(16);
  }

  encrypt(text: string): string {
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return `${this.iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
  }
}