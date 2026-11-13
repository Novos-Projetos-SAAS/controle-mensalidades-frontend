import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const table = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(name, data) {
  const kind = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([kind, data])) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  kind.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return out;
}
for (const size of [192, 512]) {
  const row = size * 4 + 1;
  const pixels = Buffer.alloc(row * size);
  const center = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center);
      const dot = Math.hypot(x - size * 0.67, y - size * 0.34);
      const ring = distance > size * 0.175 && distance < size * 0.28;
      const color = dot < size * 0.055 ? [226, 173, 118] : ring ? [255, 255, 255] : [17, 107, 113];
      const offset = y * row + 1 + x * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
