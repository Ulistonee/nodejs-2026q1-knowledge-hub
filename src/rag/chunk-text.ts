export function normalizeChunkParams(
  chunkSize: number,
  chunkOverlap: number,
): { size: number; overlap: number; stride: number } {
  const size = Math.max(1, Math.floor(chunkSize));
  let overlap = Math.max(0, Math.floor(chunkOverlap));
  if (overlap >= size) {
    overlap = size - 1;
  }
  const stride = size - overlap;
  return { size, overlap, stride };
}

export function chunkTextDeterministic(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
): string[] {
  const { size, stride } = normalizeChunkParams(chunkSize, chunkOverlap);

  if (text.length === 0) {
    return [];
  }

  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) {
      break;
    }
    i += stride;
  }

  return chunks;
}
