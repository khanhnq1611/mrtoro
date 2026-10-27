import { Effect, Schema, SchemaGetter } from "effect"
import * as Tool from "./tool"
import { ToolJsonSchema } from "./json-schema"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"

const TodoArray = Schema.mutable(Schema.Array(Todo.Info))

// Some LLMs serialize the array as a JSON string instead of a real array.
// Accept unknown input and coerce: if it's a string, JSON-parse it first.
const TodosParam = Schema.Unknown.pipe(
  Schema.decodeTo(TodoArray, {
    decode: SchemaGetter.transform((input) => (typeof input === "string" ? JSON.parse(input) : input)),
    encode: SchemaGetter.passthrough({ strict: false }),
  }),
).annotate({ description: "The updated todo list" })

export const Parameters = Schema.Struct({
  todos: TodosParam,
})

// `TodosParam` accepts unknown input so the JSON-string form decodes, which also erases the
// shape from the JSON Schema generated off it. The model is shown this strict version instead,
// so it keeps seeing what a todo looks like and writes a real array.
//
// `status` and `priority` are plain strings in Todo.Info because that schema is part of the HTTP
// API. Narrowing them here is safe (every literal decodes against the runtime schema) and stops
// the model inventing values like "in-progress" that nothing downstream recognises.
const WireTodo = Schema.Struct({
  content: Schema.String.annotate({ description: "Brief description of the task" }),
  status: Schema.Literals(["pending", "in_progress", "completed", "cancelled"]).annotate({
    description: "Current status of the task",
  }),
  priority: Schema.Literals(["high", "medium", "low"]).annotate({ description: "Priority level of the task" }),
}).annotate({ identifier: "Todo" })

export const WireParameters = Schema.Struct({
  todos: Schema.mutable(Schema.Array(WireTodo)).annotate({ description: "The updated todo list" }),
})

type Metadata = {
  todos: Todo.Info[]
}

export const TodoWriteTool = Tool.define<typeof Parameters, Metadata, Todo.Service>(
  "todowrite",
  Effect.gen(function* () {
    const todo = yield* Todo.Service

    return {
      description: DESCRIPTION_WRITE,
      parameters: Parameters,
      jsonSchema: ToolJsonSchema.fromSchema(WireParameters),
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "todowrite",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          yield* todo.update({
            sessionID: ctx.sessionID,
            todos: params.todos,
          })

          return {
            title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
            output: JSON.stringify(params.todos, null, 2),
            metadata: {
              todos: params.todos,
            },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
