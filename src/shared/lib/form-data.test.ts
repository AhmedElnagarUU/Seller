import { describe, expect, it } from "vitest";
import { readCheckbox, readLines, readText } from "@/shared/lib/form-data";

describe("readText", () => {
  it("returns the text, or an empty string for a missing field or a file", () => {
    const formData = new FormData();
    formData.set("name", "Aurora");
    formData.set("upload", new File(["x"], "x.txt"));

    expect(readText(formData, "name")).toBe("Aurora");
    expect(readText(formData, "missing")).toBe("");
    expect(readText(formData, "upload")).toBe("");
  });
});

describe("readCheckbox", () => {
  it("is true only when the box was sent", () => {
    const formData = new FormData();
    formData.set("featured", "on");

    expect(readCheckbox(formData, "featured")).toBe(true);
    expect(readCheckbox(formData, "other")).toBe(false);
  });
});

describe("readLines", () => {
  it("trims each line and drops empty lines", () => {
    const formData = new FormData();
    formData.set("features", "  Dark mode \n\n\r\nFast\n   ");

    expect(readLines(formData, "features")).toEqual(["Dark mode", "Fast"]);
    expect(readLines(formData, "missing")).toEqual([]);
  });
});
