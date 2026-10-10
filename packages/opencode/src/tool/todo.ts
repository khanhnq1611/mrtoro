import { Effect, Schema, SchemaGetter } from "effect"
import * as Tool from "./tool"
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
