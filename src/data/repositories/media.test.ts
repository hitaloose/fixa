import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { fixedClock } from "../../lib/clock";
import { sha256Hex } from "../../lib/hash";
import { createRepositories } from "./index";

function setup() {
  const db = testDb();
  const ids = { next: () => "unused" };
  return { db, media: createRepositories({ db, clock: fixedClock(0), ids }).media };
}

describe("media.storeFile", () => {
  it("names the file by its content hash, keeping the extension", async () => {
    const { media } = setup();
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const stored = await media.storeFile(blob, "Foto do Gato.PNG");
    const hash = await sha256Hex("png-bytes");
    expect(stored).toMatchObject({ id: hash, fileName: `${hash}.png`, mime: "image/png", size: 9 });
    expect((await media.byFileName(`${hash}.png`))?.id).toBe(hash);
  });

  it("derives the extension from the type when the name has none", async () => {
    const { media } = setup();
    const stored = await media.storeFile(new Blob(["a"], { type: "audio/mpeg" }), "gravação");
    expect(stored.fileName).toMatch(/^[0-9a-f]{64}\.mp3$/);
  });

  it("falls back to .bin and a generic type for unknown files", async () => {
    const { media } = setup();
    const stored = await media.storeFile(new Blob(["a"]), "x");
    expect(stored).toMatchObject({ mime: "application/octet-stream" });
    expect(stored.fileName).toMatch(/\.bin$/);
  });

  it("stores the same content once", async () => {
    const { db, media } = setup();
    await media.storeFile(new Blob(["same"], { type: "image/png" }), "a.png");
    const second = await media.storeFile(new Blob(["same"], { type: "image/jpeg" }), "b.jpg");
    expect(second.fileName.endsWith(".png")).toBe(true);
    expect(await db.media.count()).toBe(1);
  });

  it("finds nothing for an unknown file name", async () => {
    const { media } = setup();
    expect(await media.byFileName("nope.png")).toBeUndefined();
  });
});
