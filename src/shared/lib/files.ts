const BYTES_PER_MEGABYTE = 1_048_576;

// 1 MB = 1 048 576 bytes, like the 200 MB limit. 1572864 gives "1.5 MB".
export function formatMegabytes(sizeBytes: number): string {
  return `${(sizeBytes / BYTES_PER_MEGABYTE).toFixed(1)} MB`;
}
