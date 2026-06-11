import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function md5(str: string): string {
  const k = [];
  let i = 0;
  for (; i < 64;) {
    k[i] = 0 | (Math.abs(Math.sin(++i)) * 4294967296);
  }
  const s = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const strLen = str.length;
  // Convert string to array of bytes
  const bytes = [];
  for (let j = 0; j < strLen; j++) {
    const code = str.charCodeAt(j);
    if (code < 128) bytes.push(code);
    else if (code < 2048) {
      bytes.push((code >> 6) | 192);
      bytes.push((code & 63) | 128);
    } else {
      bytes.push((code >> 12) | 224);
      bytes.push(((code >> 6) & 63) | 128);
      bytes.push((code & 63) | 128);
    }
  }
  const msgLen = bytes.length;
  bytes.push(128);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  // append length in bits (low-order 32-bit first)
  const bits = msgLen * 8;
  bytes.push(bits & 0xff);
  bytes.push((bits >> 8) & 0xff);
  bytes.push((bits >> 16) & 0xff);
  bytes.push((bits >> 24) & 0xff);
  bytes.push(0); bytes.push(0); bytes.push(0); bytes.push(0);

  for (i = 0; i < bytes.length; i += 64) {
    const w = [];
    for (let n = 0; n < 16; n++) {
      w[n] = bytes[i + n * 4] | (bytes[i + n * 4 + 1] << 8) | (bytes[i + n * 4 + 2] << 16) | (bytes[i + n * 4 + 3] << 24);
    }
    const aa = a, bb = b, cc = c, dd = d;
    for (let r = 0; r < 64; r++) {
      let f: number;
      let g: number;
      if (r < 16) {
        f = (b & c) | (~b & d);
        g = r;
      } else if (r < 32) {
        f = (d & b) | (~d & c);
        g = (5 * r + 1) % 16;
      } else if (r < 48) {
        f = b ^ c ^ d;
        g = (3 * r + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * r) % 16;
      }
      const temp = d;
      d = c;
      c = b;
      const rot = s[(r >> 4) * 4 + (r % 4)];
      const sum = a + f + k[r] + w[g];
      b = b + ((sum << rot) | (sum >>> (32 - rot)));
      a = temp;
    }
    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }
  const hex = function(x: number) {
    let s = "", j = 0;
    for (; j < 4; j++) {
      const byte = (x >> (j * 8)) & 0xff;
      s += ("0" + byte.toString(16)).slice(-2);
    }
    return s;
  };
  return hex(a) + hex(b) + hex(c) + hex(d);
}

export function generateAnonymousToken(userId: string, pollId: string): string {
  const hash = md5(`${userId}-${pollId}`);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

export function generateGradient(str: string): string {
  if (!str) return 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradients = [
    'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)', // Violet-to-Indigo
    'linear-gradient(135deg, #2dd4bf 0%, #10b981 100%)', // Teal-to-Emerald
    'linear-gradient(135deg, #fb923c 0%, #ef4444 100%)', // Orange-to-Red
    'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // Blue-to-Cyan
    'linear-gradient(135deg, #f472b6 0%, #f43f5e 100%)', // Pink-to-Rose
    'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // Amber-to-Yellow
  ];
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}
