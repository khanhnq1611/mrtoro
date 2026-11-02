import { ACCEPTED_FILE_TYPES, ACCEPTED_IMAGE_TYPES } from "@/constants/file-picker"

export { ACCEPTED_FILE_TYPES }

type AttachmentPicker = (
  options: {
    defaultPath?: string
    multiple?: boolean
    accept?: string[]
  },
  onFile: (file: File) => Promise<unknown>,
) => Promise<void>

export function pickAttachmentFiles(input: {
  picker?: AttachmentPicker
  directory: () => string
  fallback: () => void
  onFile: (file: File) => Promise<unknown>
  onError: (error: unknown) => void
}) {
  if (!input.picker) {
    input.fallback()
    return
  }
  void input
    .picker(
      {
        defaultPath: input.directory(),
        multiple: true,
        accept: ACCEPTED_FILE_TYPES,
      },
      input.onFile,
    )
    .catch(input.onError)
}

const IMAGE_MIMES = new Set(ACCEPTED_IMAGE_TYPES)
const IMAGE_EXTS = new Map([
  ["gif", "image/gif"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  ["avif", "image/avif"],
])
const TEXT_MIMES = new Set([
  "application/json",
  "application/ld+json",
  "application/toml",
  "application/x-toml",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
])

const SAMPLE = 4096

function kind(type: string) {
  return type.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

function ext(name: string) {
  const idx = name.lastIndexOf(".")
  if (idx === -1) return ""
  return name.slice(idx + 1).toLowerCase()
}

function textMime(type: string) {
  if (!type) return false
  if (type.startsWith("text/")) return true
  if (TEXT_MIMES.has(type)) return true
  if (type.endsWith("+json")) return true
  return type.endsWith("+xml")
}

function textBytes(bytes: Uint8Array) {
  if (bytes.length === 0) return true
  let count = 0
  for (const byte of bytes) {
    if (byte === 0) return false
    if (byte < 9 || (byte > 13 && byte < 32)) count += 1
  }
  return count / bytes.length <= 0.3
}

export async function attachmentMime(file: File) {
  const type = kind(file.type)
  if (IMAGE_MIMES.has(type)) return type
  if (type === "application/pdf") return type

  const suffix = ext(file.name)
  const fallback = IMAGE_EXTS.get(suffix) ?? (suffix === "pdf" ? "application/pdf" : undefined)
  if ((!type || type === "application/octet-stream") && fallback) return fallback

  if (textMime(type)) return "text/plain"
  const bytes = new Uint8Array(await file.slice(0, SAMPLE).arrayBuffer())
  if (!textBytes(bytes)) return
  return "text/plain"
}

// Mimes the server-side image pipeline (Photon) can decode on its own.
const SERVER_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])
const CONVERT_MAX_DIMENSION = 1920
const CONVERT_MAX_BYTES = 4 * 1024 * 1024
const CONVERT_TIMEOUT_MS = 2000
const CONVERT_JPEG_QUALITY = 0.85

// Re-encodes an image through the browser's decoder before it is attached, so
// formats the server cannot decode (HEIC, AVIF, ...) become JPEG/PNG and huge
// photos are downscaled. Anything the browser itself cannot decode is returned
// unchanged; the server degrades such attachments to a note instead of failing
// the prompt.
export async function convertImageFile(file: File, mime: string): Promise<{ file: File; mime: string }> {
  if (!mime.startsWith("image/") || mime === "image/gif") return { file, mime }
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return { file, mime }
  try {
    const converted = await Promise.race([
      (async () => {
        const bitmap = await createImageBitmap(file)
        try {
          const oversized =
            bitmap.width > CONVERT_MAX_DIMENSION || bitmap.height > CONVERT_MAX_DIMENSION || file.size > CONVERT_MAX_BYTES
          if (SERVER_IMAGE_MIMES.has(mime) && !oversized) return undefined
          const scale = Math.min(1, CONVERT_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, Math.round(bitmap.width * scale))
          canvas.height = Math.max(1, Math.round(bitmap.height * scale))
          const ctx = canvas.getContext("2d")
          if (!ctx) return undefined
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          const type = mime === "image/png" ? "image/png" : "image/jpeg"
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, CONVERT_JPEG_QUALITY))
          if (!blob) return undefined
          return { blob, type }
        } finally {
          bitmap.close()
        }
      })(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), CONVERT_TIMEOUT_MS)),
    ])
    if (!converted) return { file, mime }
    return { file: new File([converted.blob], file.name, { type: converted.type }), mime: converted.type }
  } catch {
    return { file, mime }
  }
}
