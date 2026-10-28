// @refresh reload

import * as Sentry from "@sentry/solid"
import { onMount } from "solid-js"
import { render } from "solid-js/web"
import { HashRouter } from "@solidjs/router"
import { AppBaseProviders, AppInterface } from "@/app"
import { loadInitialLocale } from "@/context/language"
import { type Platform, PlatformProvider } from "@/context/platform"
import { createBrowserDraftStore } from "@/utils/draft-store"
import { dict as en } from "@/i18n/en"
import { dict as zh } from "@/i18n/zh"
import { authFromToken } from "@/utils/server"
import pkg from "../package.json"
import { ServerConnection } from "./context/server"
import { useLayout } from "./context/layout"
import { relayEnvironment } from "./utils/relay"

const DEFAULT_SERVER_URL_KEY = "opencode.settings.dat:defaultServerUrl"

// mrtoro: the relay serves this app at /env/<envID>/ and proxies that
// environment's API at /api/env/<envID>. Every environment shares the relay's
// origin, so a remembered default server must not leak from one to another.
// In-app routes live in the hash (/env/<envID>/#/session/…): with a router
// `base`, location.pathname would include the prefix and break the app's
// comparisons against "/" and "/new-session".

// mrtoro: parts of the SDK join paths like `new URL("/api/session", base)`,
// which drops the /api/env/<envID> prefix. The app never calls the relay's own
// endpoints, so route every same-origin request outside /app back under it.
if (relayEnvironment) {
  const prefix = `/api/env/${relayEnvironment}`
  const original = globalThis.fetch.bind(globalThis)
  const scoped = (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined
    const url = new URL(request ? request.url : input.toString(), location.href)
    const routed =
      url.origin !== location.origin ||
      url.pathname === prefix ||
      url.pathname.startsWith(prefix + "/") ||
      url.pathname.startsWith("/app/")
    if (routed) return original(input, init)
    url.pathname = prefix + url.pathname
    return original(request ? new Request(url, request) : url, init)
  }
  globalThis.fetch = Object.assign(scoped, { preconnect: () => {} }) as typeof fetch
}

// An environment is one directory on one machine: show it as the project
// instead of asking the user to add it by hand.
function RelayProject() {
  const layout = useLayout()
  onMount(() => {
    void fetch("/path")
      .then((response) => response.json())
      .then((info: { directory?: string }) => {
        if (info.directory) layout.projects.open(info.directory)
      })
      .catch(() => {})
  })
  return null
}

const getLocale = () => {
  if (typeof navigator !== "object") return "en" as const
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    if (!language) continue
    if (language.toLowerCase().startsWith("zh")) return "zh" as const
  }
  return "en" as const
}

const getRootNotFoundError = () => {
  const key = "error.dev.rootNotFound" as const
  const locale = getLocale()
  return locale === "zh" ? (zh[key] ?? en[key]) : en[key]
}

const getStorage = (key: string) => {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const setStorage = (key: string, value: string | null) => {
  if (typeof localStorage === "undefined") return
  try {
    if (value !== null) {
      localStorage.setItem(key, value)
      return
    }
    localStorage.removeItem(key)
  } catch {
    return
  }
}

const readDefaultServerUrl = () => getStorage(DEFAULT_SERVER_URL_KEY)
const writeDefaultServerUrl = (url: string | null) => setStorage(DEFAULT_SERVER_URL_KEY, url)

const notify: Platform["notify"] = async (title, description, onClick) => {
  if (!("Notification" in window)) return

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission().catch(() => "denied")
      : Notification.permission

  if (permission !== "granted") return

  const inView = document.visibilityState === "visible" && document.hasFocus()
  if (inView) return

  const notification = new Notification(title, {
    body: description ?? "",
    icon: `${import.meta.env.BASE_URL}torolab-96x96.png`,
  })

  notification.onclick = () => {
    window.focus()
    onClick?.()
    notification.close()
  }
}

const openExternal: Platform["openExternal"] = (value) => {
  if (!URL.canParse(value)) return
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") return
  window.open(url.href, "_blank", "noopener,noreferrer")
}

const restart: Platform["restart"] = async () => {
  window.location.reload()
}

const root = document.getElementById("root")
if (!(root instanceof HTMLElement) && import.meta.env.DEV) {
  throw new Error(getRootNotFoundError())
}

const getCurrentUrl = () => {
  if (relayEnvironment) return `${location.origin}/api/env/${relayEnvironment}`
  if (location.hostname.includes("opencode.ai")) return "http://localhost:4096"
  if (import.meta.env.DEV)
    return `http://${import.meta.env.VITE_OPENCODE_SERVER_HOST ?? "localhost"}:${import.meta.env.VITE_OPENCODE_SERVER_PORT ?? "4096"}`
  return location.origin
}

const getDefaultUrl = () => {
  if (relayEnvironment) return getCurrentUrl()
  const lsDefault = readDefaultServerUrl()
  if (lsDefault) return lsDefault
  return getCurrentUrl()
}

const clearAuthToken = () => {
  const params = new URLSearchParams(location.search)
  if (!params.has("auth_token")) return
  params.delete("auth_token")
  history.replaceState(null, "", location.pathname + (params.size ? `?${params}` : "") + location.hash)
}

const platform: Platform = {
  platform: "web",
  draftStore: createBrowserDraftStore(),
  version: pkg.version,
  openExternal,
  restart,
  notify,
  getDefaultServer: async () => {
    if (relayEnvironment) return ServerConnection.Key.make(getCurrentUrl())
    const stored = readDefaultServerUrl()
    return stored ? ServerConnection.Key.make(stored) : null
  },
  setDefaultServer: (url) => {
    if (relayEnvironment) return
    writeDefaultServerUrl(url)
  },
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE ?? `web@${pkg.version}`,
    initialScope: {
      tags: {
        platform: "web",
      },
    },
    integrations: (integrations) => {
      return integrations.filter(
        (i) =>
          i.name !== "Breadcrumbs" && !(import.meta.env.OPENCODE_CHANNEL === "prod" && i.name === "GlobalHandlers"),
      )
    },
  })
}

if (root instanceof HTMLElement) {
  void loadInitialLocale().then((locale) => {
    const auth = authFromToken(new URLSearchParams(location.search).get("auth_token"))
    clearAuthToken()
    const server: ServerConnection.Http = {
      type: "http",
      authToken: !!auth,
      http: {
        url: getCurrentUrl(),
        ...auth,
      },
    }
    render(
      () => (
        <PlatformProvider value={platform}>
          <AppBaseProviders locale={locale}>
            <AppInterface
              defaultServer={ServerConnection.Key.make(getDefaultUrl())}
              canonicalLocalServer={ServerConnection.key(server)}
              servers={[server]}
              router={relayEnvironment ? HashRouter : undefined}
              serverScoped={relayEnvironment ? <RelayProject /> : undefined}
              disableHealthCheck
            />
          </AppBaseProviders>
        </PlatformProvider>
      ),
      root,
    )
  })
}
