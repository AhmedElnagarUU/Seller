const VERSION_PARTS_COUNT = 3;

// The three numbers of a version like "1.4.0". The input already matches the `semver` format.
function toParts(version: string): number[] {
  return version.split(".", VERSION_PARTS_COUNT).map(Number);
}

// Compares major, then minor, then patch as numbers ("1.10.0" is higher than "1.9.0").
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const aParts = toParts(a);
  const bParts = toParts(b);
  for (let index = 0; index < VERSION_PARTS_COUNT; index += 1) {
    const aPart = aParts[index] ?? 0;
    const bPart = bParts[index] ?? 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  return 0;
}

// "1.4.0" gives "1.4.1".
export function nextPatchVersion(version: string): string {
  const [major, minor, patch] = toParts(version);
  return `${major}.${minor}.${(patch ?? 0) + 1}`;
}
