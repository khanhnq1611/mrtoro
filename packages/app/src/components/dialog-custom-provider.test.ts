import { describe, expect, test } from "bun:test"
import { validateCustomProvider, validateProviderEdit } from "./dialog-custom-provider-form"

const t = (key: string) => key

describe("validateCustomProvider", () => {
  test("builds trimmed config payload", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "custom-provider",
        name: " Custom Provider ",
        baseURL: "https://api.example.com ",
        apiKey: " {env: CUSTOM_PROVIDER_KEY} ",
        models: [{ row: "m0", id: " model-a ", name: " Model A ", err: {} }],
        headers: [
          { row: "h0", key: " X-Test ", value: " enabled ", err: {} },
          { row: "h1", key: "", value: "", err: {} },
        ],
        err: {},
      },
      t,
      disabledProviders: [],
      existingProviderIDs: new Set(),
    })

    expect(result.result).toEqual({
      providerID: "custom-provider",
      name: "Custom Provider",
      key: undefined,
      config: {
        npm: "@ai-sdk/openai-compatible",
        name: "Custom Provider",
        env: ["CUSTOM_PROVIDER_KEY"],
        options: {
          baseURL: "https://api.example.com",
          headers: {
            "X-Test": "enabled",
          },
        },
        models: {
          "model-a": { name: "Model A" },
        },
      },
    })
  })

  test("flags duplicate rows and allows reconnecting disabled providers", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "custom-provider",
        name: "Provider",
        baseURL: "https://api.example.com",
        apiKey: "secret",
        models: [
          { row: "m0", id: "model-a", name: "Model A", err: {} },
          { row: "m1", id: "model-a", name: "Model A 2", err: {} },
        ],
        headers: [
          { row: "h0", key: "Authorization", value: "one", err: {} },
          { row: "h1", key: "authorization", value: "two", err: {} },
        ],
        err: {},
      },
      t,
      disabledProviders: ["custom-provider"],
      existingProviderIDs: new Set(["custom-provider"]),
    })

    expect(result.result).toBeUndefined()
    expect(result.err.providerID).toBeUndefined()
    expect(result.models[1]).toEqual({
      id: "provider.custom.error.duplicate",
      name: undefined,
    })
    expect(result.headers[1]).toEqual({
      key: "provider.custom.error.duplicate",
      value: undefined,
    })
  })
})

describe("validateProviderEdit", () => {
  test("trims the address and key", () => {
    expect(validateProviderEdit({ baseURL: " https://api.example.com/v1 ", apiKey: " sk-new ", t })).toEqual({
      err: {},
      result: { baseURL: "https://api.example.com/v1", key: "sk-new" },
    })
  })

  test("keeps the stored key when the key is left empty", () => {
    expect(validateProviderEdit({ baseURL: "http://127.0.0.1:8000/v1", apiKey: "  ", t }).result).toEqual({
      baseURL: "http://127.0.0.1:8000/v1",
      key: undefined,
    })
  })

  test("rejects a missing or non-http address", () => {
    expect(validateProviderEdit({ baseURL: " ", apiKey: "sk", t })).toEqual({
      err: { baseURL: "provider.custom.error.baseURL.required" },
    })
    expect(validateProviderEdit({ baseURL: "api.example.com", apiKey: "sk", t })).toEqual({
      err: { baseURL: "provider.custom.error.baseURL.format" },
    })
  })
})
