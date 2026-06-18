// Strip path traversal characters and limit filename length
export function sanitiseFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 200)
}

// Strip control characters and trim whitespace from text input
export function sanitiseText(input: string): string {
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim()
}
