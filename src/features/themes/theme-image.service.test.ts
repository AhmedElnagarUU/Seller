import { describe, expect, it, vi } from "vitest";
import { ThemeModel } from "@/features/themes/theme.model";
import {
  addThemeImage,
  createImageUploadUrl,
  removeThemeImage,
  reorderThemeImages,
  updateThemeImageAlt,
} from "@/features/themes/theme-image.service";
import { fakeStorage } from "@/shared/test/fakes/fake-storage";
import { createTheme } from "@/shared/test/factories";

const BAD_IMAGE_MESSAGE = "Please upload a JPG, PNG or WebP image up to 3 MB.";
const UPLOAD_NOT_FOUND_MESSAGE = "We could not find the uploaded image. Please upload it again.";
const TOO_MANY_IMAGES_MESSAGE = "A theme can have at most 12 images.";
const UNKNOWN_THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const MAX_IMAGE_BYTES = 3_145_728;

type TestImage = { key: string; alt: string; width: number; height: number };

function buildImages(count: number): TestImage[] {
  return Array.from({ length: count }, (_unused, index) => ({
    key: `theme-images/seeded/${index + 1}.png`,
    alt: `Alt ${index + 1}`,
    width: 1000 + index,
    height: 700 + index,
  }));
}

// The saved images of a theme as plain objects.
async function savedImages(themeId: string): Promise<TestImage[]> {
  const theme = await ThemeModel.findById(themeId).lean();
  return (theme?.images ?? []).map((image) => ({
    key: image.key,
    alt: image.alt,
    width: image.width,
    height: image.height,
  }));
}

// Stores a file as if the browser had uploaded it for this theme. Returns its key.
function putUploadedImage(themeId: string, contentType = "image/png", body: Buffer | string = "png-bytes"): string {
  const key = `theme-images/${themeId}/0123456789abcdef.png`;
  fakeStorage.putTestObject({ bucket: "public", key, contentType, body });
  return key;
}

describe("createImageUploadUrl", () => {
  it("refuses a GIF", async () => {
    const theme = await createTheme();
    const input = { themeId: theme._id.toString(), contentType: "image/gif", sizeBytes: 1000 };

    await expect(createImageUploadUrl(input)).rejects.toMatchObject({ code: "INVALID", message: BAD_IMAGE_MESSAGE });
    expect(fakeStorage.uploadUrlRequests).toEqual([]);
  });

  it("refuses a file over 3 MB and an empty file", async () => {
    const theme = await createTheme();
    const input = { themeId: theme._id.toString(), contentType: "image/png" };

    await expect(createImageUploadUrl({ ...input, sizeBytes: 3145729 })).rejects.toMatchObject({
      code: "INVALID",
      message: BAD_IMAGE_MESSAGE,
    });
    await expect(createImageUploadUrl({ ...input, sizeBytes: 0 })).rejects.toMatchObject({
      code: "INVALID",
      message: BAD_IMAGE_MESSAGE,
    });
    expect(fakeStorage.uploadUrlRequests).toEqual([]);
  });

  it("refuses a 13th image", async () => {
    const theme = await createTheme({ images: buildImages(12) });
    const input = { themeId: theme._id.toString(), contentType: "image/png", sizeBytes: 1000 };

    await expect(createImageUploadUrl(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: TOO_MANY_IMAGES_MESSAGE,
    });
    expect(fakeStorage.uploadUrlRequests).toEqual([]);
  });

  it("refuses an unknown theme", async () => {
    const input = { themeId: UNKNOWN_THEME_ID, contentType: "image/png", sizeBytes: 1000 };

    await expect(createImageUploadUrl(input)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Theme not found.",
    });
    expect(fakeStorage.uploadUrlRequests).toEqual([]);
  });

  it("returns a key under `theme-images/<themeId>/` and a Cache-Control header", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();

    const result = await createImageUploadUrl({ themeId, contentType: "image/png", sizeBytes: 1000 });

    expect(result.key).toMatch(new RegExp(`^theme-images/${themeId}/[0-9a-f]{16}\\.png$`));
    expect(result.headers).toEqual({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    expect(fakeStorage.uploadUrlRequests).toEqual([
      {
        bucket: "public",
        key: result.key,
        contentType: "image/png",
        sizeBytes: 1000,
        cacheControl: "public, max-age=31536000, immutable",
        expiresInSeconds: 600,
      },
    ]);
  });
});

describe("addThemeImage", () => {
  it("refuses a key of another theme", async () => {
    const theme = await createTheme();
    const otherTheme = await createTheme();
    const themeId = theme._id.toString();
    const key = putUploadedImage(otherTheme._id.toString());

    await expect(addThemeImage({ themeId, key, alt: "", width: 1200, height: 800 })).rejects.toMatchObject({
      code: "INVALID",
      message: UPLOAD_NOT_FOUND_MESSAGE,
    });
    expect(await savedImages(themeId)).toEqual([]);
  });

  it("refuses a key that is already in the list", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const key = putUploadedImage(themeId);
    await addThemeImage({ themeId, key, alt: "First", width: 1200, height: 800 });

    await expect(addThemeImage({ themeId, key, alt: "Again", width: 1200, height: 800 })).rejects.toMatchObject({
      code: "INVALID",
      message: UPLOAD_NOT_FOUND_MESSAGE,
    });
    expect(await savedImages(themeId)).toEqual([{ key, alt: "First", width: 1200, height: 800 }]);
  });

  it("refuses when the object is missing in storage", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const key = `theme-images/${themeId}/0123456789abcdef.png`;

    await expect(addThemeImage({ themeId, key, alt: "", width: 1200, height: 800 })).rejects.toMatchObject({
      code: "INVALID",
      message: UPLOAD_NOT_FOUND_MESSAGE,
    });
    expect(await savedImages(themeId)).toEqual([]);
  });

  it("deletes and refuses a stored object over 3 MB", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const key = putUploadedImage(themeId, "image/png", Buffer.alloc(MAX_IMAGE_BYTES + 1));

    await expect(addThemeImage({ themeId, key, alt: "", width: 1200, height: 800 })).rejects.toMatchObject({
      code: "INVALID",
      message: BAD_IMAGE_MESSAGE,
    });
    expect(fakeStorage.objects.has(`public/${key}`)).toBe(false);
    expect(await savedImages(themeId)).toEqual([]);
  });

  it("deletes and refuses a stored object of another type", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const key = putUploadedImage(themeId, "image/gif");

    await expect(addThemeImage({ themeId, key, alt: "", width: 1200, height: 800 })).rejects.toMatchObject({
      code: "INVALID",
      message: BAD_IMAGE_MESSAGE,
    });
    expect(fakeStorage.objects.has(`public/${key}`)).toBe(false);
    expect(await savedImages(themeId)).toEqual([]);
  });

  it("adds the image at the end with alt, width and height", async () => {
    const [firstImage] = buildImages(1);
    const theme = await createTheme({ images: buildImages(1) });
    const themeId = theme._id.toString();
    const key = putUploadedImage(themeId);

    await addThemeImage({ themeId, key, alt: "Hero", width: 1200, height: 800 });

    expect(await savedImages(themeId)).toEqual([firstImage, { key, alt: "Hero", width: 1200, height: 800 }]);
    expect(fakeStorage.objects.has(`public/${key}`)).toBe(true);
  });

  it("refuses a 13th image even when the check before was passed", async () => {
    const theme = await createTheme({ images: buildImages(12) });
    const themeId = theme._id.toString();
    const key = putUploadedImage(themeId);

    await expect(addThemeImage({ themeId, key, alt: "", width: 1200, height: 800 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: TOO_MANY_IMAGES_MESSAGE,
    });
    expect(await savedImages(themeId)).toEqual(buildImages(12));
  });
});

describe("removeThemeImage", () => {
  // A theme whose images are also in the fake storage.
  async function createThemeWithStoredImages(count: number, status: "draft" | "published" = "draft") {
    const images = buildImages(count);
    for (const image of images) {
      fakeStorage.putTestObject({ bucket: "public", key: image.key, contentType: "image/png", body: "png-bytes" });
    }
    const theme = await createTheme({ images, status });
    return { themeId: theme._id.toString(), images };
  }

  it("refuses removing the only image of a published theme", async () => {
    const { themeId, images } = await createThemeWithStoredImages(1, "published");
    const key = images[0]?.key ?? "";

    await expect(removeThemeImage({ themeId, key })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A published theme needs at least one image.",
    });
    expect(await savedImages(themeId)).toEqual(images);
    expect(fakeStorage.objects.has(`public/${key}`)).toBe(true);
  });

  it("allows removing the only image of a draft theme", async () => {
    const { themeId, images } = await createThemeWithStoredImages(1);

    await removeThemeImage({ themeId, key: images[0]?.key ?? "" });

    expect(await savedImages(themeId)).toEqual([]);
  });

  it("removes from the database and deletes the object", async () => {
    const { themeId, images } = await createThemeWithStoredImages(2, "published");
    const [firstImage, secondImage] = images;

    await removeThemeImage({ themeId, key: firstImage?.key ?? "" });

    expect(await savedImages(themeId)).toEqual([secondImage]);
    expect(fakeStorage.objects.has(`public/${firstImage?.key}`)).toBe(false);
    expect(fakeStorage.objects.has(`public/${secondImage?.key}`)).toBe(true);
  });

  it("refuses an unknown key", async () => {
    const { themeId, images } = await createThemeWithStoredImages(2);

    await expect(removeThemeImage({ themeId, key: "theme-images/seeded/unknown.png" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Image not found.",
    });
    expect(await savedImages(themeId)).toEqual(images);
    expect(fakeStorage.objects.size).toBe(2);
  });

  it("still succeeds when deleting the object fails", async () => {
    const { themeId, images } = await createThemeWithStoredImages(2);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeStorage.failNextDelete(new Error("boom"));

    await expect(removeThemeImage({ themeId, key: images[0]?.key ?? "" })).resolves.toBeUndefined();

    expect(await savedImages(themeId)).toEqual([images[1]]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toEqual(["removeThemeImage: could not delete the stored image"]);
    consoleError.mockRestore();
  });
});

describe("reorderThemeImages", () => {
  it("refuses a list with a missing key", async () => {
    const images = buildImages(3);
    const theme = await createTheme({ images });
    const themeId = theme._id.toString();
    const keys = [images[2]?.key ?? "", images[0]?.key ?? ""];

    await expect(reorderThemeImages({ themeId, keys })).rejects.toMatchObject({
      code: "INVALID",
      message: "The image list changed. Please reload the page.",
    });
    expect(await savedImages(themeId)).toEqual(images);
  });

  it("refuses a list with a duplicate key and the same length", async () => {
    const images = buildImages(3);
    const theme = await createTheme({ images });
    const themeId = theme._id.toString();
    const keys = [images[2]?.key ?? "", images[0]?.key ?? "", images[0]?.key ?? ""];

    await expect(reorderThemeImages({ themeId, keys })).rejects.toMatchObject({
      code: "INVALID",
      message: "The image list changed. Please reload the page.",
    });
    expect(await savedImages(themeId)).toEqual(images);
  });

  it("saves the new order and keeps alt, width and height", async () => {
    const images = buildImages(3);
    const theme = await createTheme({ images });
    const themeId = theme._id.toString();
    const reversed = [...images].reverse();

    await reorderThemeImages({ themeId, keys: reversed.map((image) => image.key) });

    const saved = await savedImages(themeId);
    expect(saved).toEqual(reversed);
    expect(saved[0]).toEqual({ key: "theme-images/seeded/3.png", alt: "Alt 3", width: 1002, height: 702 });
  });
});

describe("updateThemeImageAlt", () => {
  it("changes only the alt of that image", async () => {
    const images = buildImages(3);
    const theme = await createTheme({ images });
    const themeId = theme._id.toString();

    await updateThemeImageAlt({ themeId, key: images[1]?.key ?? "", alt: "New alt" });

    expect(await savedImages(themeId)).toEqual([images[0], { ...images[1], alt: "New alt" }, images[2]]);
  });

  it("refuses an unknown key", async () => {
    const images = buildImages(2);
    const theme = await createTheme({ images });
    const themeId = theme._id.toString();

    await expect(
      updateThemeImageAlt({ themeId, key: "theme-images/seeded/unknown.png", alt: "New alt" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Image not found." });
    expect(await savedImages(themeId)).toEqual(images);
  });
});
