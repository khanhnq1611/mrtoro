import { onMount } from "solid-js"
import { makeEventListener } from "@solid-primitives/event-listener"
import type { PromptInputV2Attachment, PromptInputV2Prompt } from "./types"

export const accepted = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/pdf",
  "text/*",
  "application/json",
  "application/ld+json",
  "application/toml",
  "application/x-toml",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
  ".c",
  ".cc",
  ".cjs",
  ".conf",
  ".cpp",
  ".css",
  ".csv",
  ".cts",
  ".env",
  ".go",
  ".gql",
  ".graphql",
  ".h",
  ".hh",
  ".hpp",
  ".htm",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".py",
  ".rb",
  ".rs",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]

type PromptTarget = {
  current: () => PromptInputV2Prompt
  cursor: () => number | undefined
  set: (prompt: PromptInputV2Prompt, cursor?: number) => void
}

export type PromptInputV2AttachmentConfig = {
  picker?: (
    options: { defaultPath?: string; multiple?: boolean; accept?: string[] },
    onFile: (file: File) => Promise<unknown>,
  ) => Promise<void>
  directory: () => string
  isDialogActive: () => boolean
  warn: () => void
  duplicate: () => void
  onError: (error: unknown) => void
  readClipboardImage?: () => Promise<File | null>
  getPathForFile?: (file: File) => string
  store?: (file: File) => Promise<{ id: string; url: string }>
}

export function createPromptInputV2Attachments(
  input: PromptInputV2AttachmentConfig & {
    capture: () => PromptTarget
    editor: () => HTMLElement | undefined
    focusEditor: () => void
    addPart: (part: PromptInputV2Prompt[number]) => boolean
    setDraggingType: (type: "image" | "@mention" | null) => void
  },
) {
  const capture = () => {
    const prompt = input.capture()
    const editor = input.editor()
    if (!editor) return
    return { prompt, cursor: prompt.cursor() ?? cursorPosition(editor) }
  }
  const add = async (file: File, toast = true, target = capture(), clipboard = false) => {
    if (!target) return false
    const mime = await attachmentMime(file)
    if (!mime) {
      if (toast) input.warn()
      return false
    }
    const converted = await convertImageFile(file, mime)
    const blob = input.store ? await input.store(converted.file) : await blobReference(converted.file)
    const sourcePath = input.getPathForFile?.(file) || undefined
    // Native clipboard images arrive with a fresh timestamped filename on every paste, so identical
    // clipboard content is matched on bytes alone.
    const duplicate = target.prompt
      .current()
      .some(
        (part) =>
          part.type === "image" &&
          part.blob.id === blob.id &&
          (sourcePath
            ? part.sourcePath === sourcePath
            : !part.sourcePath && (clipboard || part.filename === file.name)),
      )
    if (duplicate) {
      input.duplicate()
      return true
    }
    const attachment: PromptInputV2Attachment = {
      type: "image",
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2),
      filename: file.name,
      sourcePath,
      mime: converted.mime,
      blob,
    }
    target.prompt.set([...target.prompt.current(), attachment], target.cursor)
    return true
  }
  const addAttachments = async (files: File[], toast = true, target = capture()) => {
    const found = await files.reduce(async (result, file) => {
      const previous = await result
      return (await add(file, false, target)) || previous
    }, Promise.resolve(false))
    if (!found && files.length > 0 && toast) input.warn()
    return found
  }
  const handlePaste = async (event: ClipboardEvent) => {
    const clipboardData = event.clipboardData
    if (!clipboardData) return
    const target = capture()
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    const files = Array.from(clipboardData.items).flatMap((item) => {
      if (item.kind !== "file") return []
      const file = item.getAsFile()
      return file ? [file] : []
    })
    if (files.length > 0) {
      await addAttachments(files, true, target)
      return
    }
    const plainText = clipboardData.getData("text/plain") ?? ""
    if (input.readClipboardImage && !plainText) {
      const file = await input.readClipboardImage()
      if (file && (await add(file, true, target, true))) return
    }
    if (!plainText) return
    const text = plainText.includes("\r") ? plainText.replace(/\r\n?/g, "\n") : plainText
    const put = () => {
      if (input.addPart({ type: "text", content: text, start: 0, end: 0 })) return true
      input.focusEditor()
      return input.addPart({ type: "text", content: text, start: 0, end: 0 })
    }
    if (text.includes("\n") || largePaste(text)) {
      put()
      return
    }
    if (typeof document.execCommand === "function" && document.execCommand("insertText", false, text)) return
    put()
  }
  const handleDrop = async (event: DragEvent) => {
    if (input.isDialogActive()) return
    event.preventDefault()
    input.setDraggingType(null)
    const plainText = event.dataTransfer?.getData("text/plain")
    if (plainText?.startsWith("file:")) {
      const path = plainText.slice("file:".length)
      input.focusEditor()
      input.addPart({ type: "file", path, content: `@${path}`, start: 0, end: 0 })
      return
    }
    const files = event.dataTransfer?.files
    if (files) await addAttachments(Array.from(files))
  }

  onMount(() => {
    makeEventListener(document, "dragover", (event) => {
      if (input.isDialogActive()) return
      event.preventDefault()
      if (event.dataTransfer?.types.includes("Files")) input.setDraggingType("image")
      else if (event.dataTransfer?.types.includes("text/plain")) input.setDraggingType("@mention")
    })
    makeEventListener(document, "dragleave", (event) => {
      if (!input.isDialogActive() && !event.relatedTarget) input.setDraggingType(null)
    })
    makeEventListener(document, "drop", handleDrop)
  })

  return {
    addAttachments,
    handlePaste,
    handleDrop,
    pick(fallback: () => void) {
      if (!input.picker) {
        fallback()
        return
      }
      void input
        .picker({ defaultPath: input.directory(), multiple: true, accept: accepted }, (file) => add(file))
        .catch(input.onError)
    },
  }
}

const imageMimes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/heic", "image/heif", "image/avif"])

async function blobReference(file: File) {
  // crypto.subtle is undefined on insecure (http:) origins; fall back to random ids there.
  const bytes =
    crypto.subtle ? new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())) : crypto.getRandomValues(new Uint8Array(16))
  const id = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return { id, url: URL.createObjectURL(file) }
}
const imageExtensions = new Map([
  ["gif", "image/gif"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  ["avif", "image/avif"],
])
const textMimes = new Set([
  "application/json",
  "application/ld+json",
  "application/toml",
  "application/x-toml",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
])

async function attachmentMime(file: File) {
  const type = file.type.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  if (imageMimes.has(type) || type === "application/pdf") return type
  const index = file.name.lastIndexOf(".")
  const suffix = index === -1 ? "" : file.name.slice(index + 1).toLowerCase()
  const fallback = imageExtensions.get(suffix) ?? (suffix === "pdf" ? "application/pdf" : undefined)
  if ((!type || type === "application/octet-stream") && fallback) return fallback
  if (type.startsWith("text/") || textMimes.has(type) || type.endsWith("+json") || type.endsWith("+xml")) {
    return "text/plain"
  }
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  if (bytes.some((byte) => byte === 0)) return
  const control = bytes.filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length
  if (bytes.length > 0 && control / bytes.length > 0.3) return
  return "text/plain"
}

// Mimes the server-side image pipeline (Photon) can decode on its own.
const serverImageMimes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])
const convertMaxDimension = 1920
const convertMaxBytes = 4 * 1024 * 1024
const convertTimeoutMs = 2000
const convertJpegQuality = 0.85

// Re-encodes an image through the browser's decoder before it is attached, so
// formats the server cannot decode (HEIC, AVIF, ...) become JPEG/PNG and huge
// photos are downscaled. Anything the browser itself cannot decode is returned
// unchanged; the server degrades such attachments to a note instead of failing
// the prompt.
async function convertImageFile(file: File, mime: string): Promise<{ file: File; mime: string }> {
  if (!mime.startsWith("image/") || mime === "image/gif") return { file, mime }
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return { file, mime }
  try {
    const converted = await Promise.race([
      (async () => {
        const bitmap = await createImageBitmap(file)
        try {
          const oversized =
            bitmap.width > convertMaxDimension || bitmap.height > convertMaxDimension || file.size > convertMaxBytes
          if (serverImageMimes.has(mime) && !oversized) return undefined
          const scale = Math.min(1, convertMaxDimension / Math.max(bitmap.width, bitmap.height))
          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, Math.round(bitmap.width * scale))
          canvas.height = Math.max(1, Math.round(bitmap.height * scale))
          const ctx = canvas.getContext("2d")
          if (!ctx) return undefined
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          const type = mime === "image/png" ? "image/png" : "image/jpeg"
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, convertJpegQuality))
          if (!blob) return undefined
          return { blob, type }
        } finally {
          bitmap.close()
        }
      })(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), convertTimeoutMs)),
    ])
    if (!converted) return { file, mime }
    return { file: new File([converted.blob], file.name, { type: converted.type }), mime: converted.type }
  } catch {
    return { file, mime }
  }
}

function cursorPosition(editor: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return 0
  const before = range.cloneRange()
  before.selectNodeContents(editor)
  before.setEnd(range.startContainer, range.startOffset)
  return before.toString().replace(/\u200B/g, "").length
}

function largePaste(text: string) {
  if (text.length >= 8000) return true
  return text.split("\n").length - 1 >= 120
}
