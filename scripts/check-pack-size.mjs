import { execSync } from "node:child_process";

const MAX_UNPACKED_BYTES = Number(process.env.MAX_UNPACKED_BYTES ?? 90_000);

function extractFirstJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return String(bytes);
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const raw = execSync("npm pack --dry-run --json", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const jsonArrayText = extractFirstJsonArray(raw);

if (!jsonArrayText) {
  console.error("Failed to parse `npm pack --dry-run --json` output.");
  process.exit(2);
}

const payload = JSON.parse(jsonArrayText);
const unpackedSize = payload?.[0]?.unpackedSize;

if (!Number.isFinite(unpackedSize)) {
  console.error(
    "`unpackedSize` not found in `npm pack --dry-run --json` output.",
  );
  process.exit(2);
}

if (unpackedSize > MAX_UNPACKED_BYTES) {
  console.error(
    `Package unpacked size too large: ${formatBytes(unpackedSize)} (limit: ${formatBytes(MAX_UNPACKED_BYTES)}).`,
  );
  process.exit(1);
}

console.log(
  `OK: unpacked size ${formatBytes(unpackedSize)} (limit: ${formatBytes(MAX_UNPACKED_BYTES)}).`,
);
