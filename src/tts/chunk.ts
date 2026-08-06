export function chunkText(text: string, max = 220): string[] {
  const chunks: string[] = [];
  let remaining = String(text || "").trim();

  while (remaining.length > max) {
    let slice = remaining.slice(0, max);
    const lastSpace = slice.lastIndexOf(" ");

    if (lastSpace > 100) {
      slice = slice.slice(0, lastSpace);
    }

    chunks.push(slice);
    remaining = remaining.slice(slice.length).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}
