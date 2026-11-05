import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EXACT_CLASSES = new Set([
  "flex",
  "inline-flex",
  "grid",
  "block",
  "inline-block",
  "hidden",
  "contents",
  "grow",
  "relative",
  "absolute",
  "sticky",
  "fixed",
  "truncate",
  "sr-only",
]);
const PREFIX_CLASSES = [
  "flex-",
  "grid-cols-",
  "col-span-",
  "row-span-",
  "items-",
  "justify-",
  "self-",
  "place-",
  "order-",
  "gap-",
  "space-x-",
  "space-y-",
  "shrink-",
  "w-",
  "min-w-",
  "max-w-",
  "h-",
  "min-h-",
  "max-h-",
  "size-",
  "aspect-",
  "p-",
  "px-",
  "py-",
  "pt-",
  "pb-",
  "pl-",
  "pr-",
  "m-",
  "mx-",
  "my-",
  "mt-",
  "mb-",
  "ml-",
  "mr-",
  "inset-",
  "top-",
  "bottom-",
  "left-",
  "right-",
  "z-",
  "overflow-",
  "line-clamp-",
];
const BREAKPOINT_PREFIX = /^(sm|md|lg|xl):/;

function listFiles(directory, matches) {
  const found = [];
  let entries = [];
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) found.push(...listFiles(fullPath, matches));
    else if (matches(entry)) found.push(fullPath);
  }
  return found;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function isAllowedClass(className) {
  const withoutBreakpoint = className.replace(BREAKPOINT_PREFIX, "");
  if (EXACT_CLASSES.has(withoutBreakpoint)) return true;
  return PREFIX_CLASSES.some((prefix) => withoutBreakpoint.startsWith(prefix));
}

function findClassStrings(text) {
  const found = [];
  for (const match of text.matchAll(/className\s*=\s*"([^"]*)"/g)) {
    found.push({ value: match[1], index: match.index });
  }
  for (const call of text.matchAll(/clsx\(([^)]*)\)/g)) {
    for (const literal of call[1].matchAll(/"([^"]*)"|'([^']*)'/g)) {
      found.push({ value: literal[1] ?? literal[2], index: call.index });
    }
  }
  return found;
}

function checkStyles() {
  const files = [
    ...listFiles("src/features", (name) => name.endsWith(".tsx")),
    ...listFiles("src/app", (name) => name.endsWith(".tsx")),
  ];
  const problems = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/className\s*=\s*\{\s*`/g)) {
      problems.push(`${file}:${lineOf(text, match.index)} className must not use a template string`);
    }
    for (const { value, index } of findClassStrings(text)) {
      for (const className of value.split(/\s+/).filter(Boolean)) {
        if (!isAllowedClass(className)) problems.push(`${file}:${lineOf(text, index)} ${className}`);
      }
    }
  }
  return problems;
}

function checkFocused() {
  const testFiles = [
    ...listFiles("src", (name) => name.endsWith(".test.ts") || name.endsWith(".test.tsx")),
    ...listFiles("e2e", (name) => name.endsWith(".spec.ts")),
  ];
  const problems = [];
  for (const file of testFiles) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\.(only|skip|todo)\(/g)) {
      problems.push(`${file}:${lineOf(text, match.index)} .${match[1]}(`);
    }
  }
  return problems;
}

const isFocusedMode = process.argv.includes("--focused");
const problems = isFocusedMode ? checkFocused() : checkStyles();
const okMessage = isFocusedMode ? "check:focused OK" : "check:styles OK";

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
process.stdout.write(`${okMessage}\n`);
