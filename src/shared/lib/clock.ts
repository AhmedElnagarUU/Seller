let testNow: Date | null = null;

// Current time; tests can fix it with setTestNow.
export function now(): Date {
  return testNow ?? new Date();
}

// Fixes (or with null, releases) the clock. Only allowed in tests.
export function setTestNow(date: Date | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setTestNow can only be used when NODE_ENV is test.");
  }
  testNow = date;
}
