import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function roundRect(nx, ny, left, top, right, bottom, radius) {
  if (nx < left || ny < top || nx > right || ny > bottom) return false;
  const corners = [
    [left + radius, top + radius],
    [right - radius, top + radius],
    [left + radius, bottom - radius],
    [right - radius, bottom - radius],
  ];
  const inCornerZone = [
    nx < left + radius && ny < top + radius,
    nx > right - radius && ny < top + radius,
    nx < left + radius && ny > bottom - radius,
    nx > right - radius && ny > bottom - radius,
  ];
  for (let i = 0; i < 4; i += 1) {
    if (!inCornerZone[i]) continue;
    const corner = corners[i];
    if (!corner) return false;
    const dx = nx - corner[0];
    const dy = ny - corner[1];
    if (dx * dx + dy * dy > radius * radius) return false;
  }
  return true;
}

function paint(x, y, size) {
  const nx = (x + 0.5) / size;
  const ny = (y + 0.5) / size;
  const inset = 0.06;
  if (!roundRect(nx, ny, inset, inset, 1 - inset, 1 - inset, 0.18)) return [0, 0, 0, 0];
  const dx = nx - 0.5;
  const dy = ny - 0.4;
  const inCircle = dx * dx + dy * dy <= 0.11 * 0.11;
  const inStem = nx >= 0.455 && nx <= 0.545 && ny >= 0.48 && ny <= 0.74;
  if (inCircle || inStem) return [232, 196, 140, 255];
  return [28, 36, 48, 255];
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = paint(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = pixel[0];
      raw[i + 1] = pixel[1];
      raw[i + 2] = pixel[2];
      raw[i + 3] = pixel[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(process.cwd(), "brand");
mkdirSync(outDir, { recursive: true });
const written = new Map();
for (const size of [16, 32, 48, 128]) {
  const bytes = png(size);
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, bytes);
  written.set(size, bytes);
  console.log(file);
}
const quizIcon = path.join(process.cwd(), "apps/quiz/app/icon.png");
mkdirSync(path.dirname(quizIcon), { recursive: true });
writeFileSync(quizIcon, written.get(32));
console.log(quizIcon);
