import assert from "node:assert/strict";
import test from "node:test";
import { isPdf, safeStorageFilename, verifyImage } from "../src/lib/uploads.js";

test("verifyImage derives the extension from file contents", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(verifyImage(png, new Set(["image/png"])), {
    mime: "image/png",
    extension: ".png"
  });
  assert.equal(verifyImage(png, new Set(["image/jpeg"])), null);
});

test("isPdf rejects a spoofed upload", () => {
  assert.equal(isPdf(Buffer.from("%PDF-1.7")), true);
  assert.equal(isPdf(Buffer.from("<script>alert(1)</script>")), false);
});

test("safeStorageFilename rejects traversal", () => {
  assert.equal(safeStorageFilename("recording.mp3"), "recording.mp3");
  assert.equal(safeStorageFilename("../recording.mp3"), null);
  assert.equal(safeStorageFilename("folder/recording.mp3"), null);
});
