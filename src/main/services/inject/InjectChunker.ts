export interface InjectChunk {
  index: number
  text: string
  bytes: number
}

const encoder = new TextEncoder()

export class InjectChunker {
  constructor(private readonly maxBytes = 8192) {}

  chunk(text: string): InjectChunk[] {
    if (text.length === 0) throw new Error('E_VALIDATION:text is required')
    const chunks: InjectChunk[] = []
    let buffer = ''
    let bufferBytes = 0
    for (const char of text) {
      const charBytes = encoder.encode(char).length
      if (charBytes > this.maxBytes) throw new Error('E_VALIDATION:single character exceeds chunk size')
      if (buffer.length > 0 && bufferBytes + charBytes > this.maxBytes) {
        chunks.push({ index: chunks.length, text: buffer, bytes: bufferBytes })
        buffer = ''
        bufferBytes = 0
      }
      buffer += char
      bufferBytes += charBytes
    }
    if (buffer.length > 0) chunks.push({ index: chunks.length, text: buffer, bytes: bufferBytes })
    return chunks
  }
}
