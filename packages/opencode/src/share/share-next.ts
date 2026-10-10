import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { serviceUse } from "@opencode-ai/core/effect/service-use"
import { Effect, Layer, Schema, Context } from "effect"
import type { SessionID } from "@/session/schema"

// mrtoro: session sharing went through opencode cloud (opncd.ai / console) and
// is disabled. The service is kept as an inert stub so the layer graph, server
// routes and generated SDK keep compiling, but it never touches the network.

export type Api = {
  create: string
  sync: (shareID: string) => string
  remove: (shareID: string) => string
  data: (shareID: string) => string
}

export type Req = {
  headers: Record<string, string>
  api: Api
  baseUrl: string
}

const ShareSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  secret: Schema.String,
})
export type Share = typeof ShareSchema.Type

export interface Interface {
  readonly init: () => Effect.Effect<void, unknown>
  readonly url: () => Effect.Effect<string, unknown>
  readonly request: () => Effect.Effect<Req, unknown>
  readonly create: (sessionID: SessionID) => Effect.Effect<Share, unknown>
  readonly remove: (sessionID: SessionID) => Effect.Effect<void, unknown>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ShareNext") {}

export const use = serviceUse(Service)

export class DisabledError extends Schema.TaggedErrorClass<DisabledError>()("ShareDisabledError", {
  message: Schema.String,
}) {}

const disabled = () => new DisabledError({ message: "Session sharing is disabled in mrtoro" })

const api: Api = {
  create: "",
  sync: () => "",
  remove: () => "",
  data: () => "",
}

const layer = Layer.succeed(
  Service,
  Service.of({
    init: () => Effect.void,
    url: () => Effect.fail(disabled()),
    request: () => Effect.succeed({ headers: {}, api, baseUrl: "" } satisfies Req),
    create: () => Effect.fail(disabled()),
    remove: () => Effect.void,
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [],
})

export * as ShareNext from "./share-next"
