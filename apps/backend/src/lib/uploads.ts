const IMAGE_SIGNATURES = [
  {
    mime: "image/png",
    extension: ".png",
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    mime: "image/jpeg",
    extension: ".jpg",
    matches: (buffer: Buffer) =>
      buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    mime: "image/webp",
    extension: ".webp",
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
  },
  {
    mime: "image/gif",
    extension: ".gif",
    matches: (buffer: Buffer) => {
      const signature = buffer.toString("ascii", 0, 6);
      return signature === "GIF87a" || signature === "GIF89a";
    }
  }
] as const;

export interface VerifiedImage {
  mime: (typeof IMAGE_SIGNATURES)[number]["mime"];
  extension: (typeof IMAGE_SIGNATURES)[number]["extension"];
}

export function verifyImage(
  buffer: Buffer,
  allowedMimes: ReadonlySet<string>
): VerifiedImage | null {
  const signature = IMAGE_SIGNATURES.find(
    (candidate) => allowedMimes.has(candidate.mime) && candidate.matches(buffer)
  );
  return signature ? { mime: signature.mime, extension: signature.extension } : null;
}

export function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
}

export function safeStorageFilename(filename: string): string | null {
  if (!filename || filename !== filename.split(/[\\/]/).at(-1) || filename.includes(".."))
    return null;
  return filename;
}
