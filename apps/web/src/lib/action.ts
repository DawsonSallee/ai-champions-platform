/**
 * Server-action conventions.
 *
 *   const submit = defineAction(InputSchema, async ({ input, principal }) => { ... })
 *
 * Returns a discriminated result so client code never throws. All actions:
 *  - require authentication (via `getPrincipal()`),
 *  - validate input with Zod,
 *  - run inside the service layer which wraps mutations in `audited()`.
 */
import { z } from "zod";
import { getPrincipal, type Principal } from "./auth";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function defineAction<TInput extends z.ZodTypeAny, TOutput>(
  schema: TInput,
  handler: (args: {
    input: z.infer<TInput>;
    principal: Principal;
  }) => Promise<TOutput>,
) {
  return async function action(
    raw: z.infer<TInput>,
  ): Promise<ActionResult<TOutput>> {
    const principal = await getPrincipal();
    if (!principal) {
      return { ok: false, error: "Unauthenticated" };
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: "Invalid input", fieldErrors };
    }
    try {
      const data = await handler({ input: parsed.data, principal });
      return { ok: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  };
}
