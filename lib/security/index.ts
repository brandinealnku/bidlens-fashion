import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
const privateIp = (ip: string) =>
  ip === '127.0.0.1' ||
  ip === '::1' ||
  ip.startsWith('10.') ||
  ip.startsWith('192.168.') ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
  ip.startsWith('169.254.') ||
  ip.startsWith('fc') ||
  ip.startsWith('fd');
export async function validateIngestionUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== 'https:' ||
    !(u.hostname === 'ebth.com' || u.hostname.endsWith('.ebth.com'))
  )
    throw new Error('Only supported HTTPS EBTH URLs are allowed');
  if (u.username || u.password || isIP(u.hostname))
    throw new Error('Unsafe URL');
  const addresses = await lookup(u.hostname, { all: true });
  if (addresses.some((x) => privateIp(x.address)))
    throw new Error('Private network addresses are not allowed');
  return u;
}
export function validateUpload(name: string, type: string, size: number) {
  if (size > 8 * 1024 * 1024) throw new Error('Image exceeds 8 MB');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(type))
    throw new Error('Unsupported image type');
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}
