import {
  gatesFor,
  type GateSignals,
  type GateState,
} from "@/domains/governance/gates";
import type { ProjectStatus, Tier } from "@/domains/projects/schema";

/**
 * Visual horizontal pipeline of gates for a project.
 *
 * State colors:
 *   done       — green
 *   active     — amber (currently in)
 *   upcoming   — gray (not yet reached)
 *   blocked    — red (rejected)
 */
export function GatesProgress({
  tier,
  status,
  signals,
  size = "md",
}: {
  tier: Tier | null | undefined;
  status: ProjectStatus;
  signals?: GateSignals;
  size?: "sm" | "md";
}) {
  const gates = gatesFor(tier, status, signals);

  return (
    <ol className="flex items-stretch gap-0 overflow-x-auto">
      {gates.map((g, i) => {
        const isLast = i === gates.length - 1;
        return (
          <li
            key={g.key}
            className={`flex flex-1 min-w-[7rem] items-center gap-2 ${
              isLast ? "" : "pr-1"
            }`}
          >
            <div className="flex flex-1 flex-col items-stretch">
              <div className={`flex items-center gap-2`}>
                <Glyph state={g.state} order={i + 1} size={size} />
                <div className="leading-tight">
                  <div
                    className={`font-medium ${
                      size === "sm" ? "text-xs" : "text-sm"
                    } ${textColor(g.state)}`}
                  >
                    {g.name}
                  </div>
                  {g.note && (
                    <div className="text-[10px] text-gray-500">{g.note}</div>
                  )}
                </div>
              </div>
            </div>
            {!isLast && <Connector state={g.state} />}
          </li>
        );
      })}
    </ol>
  );
}

function Glyph({
  state,
  order,
  size,
}: {
  state: GateState;
  order: number;
  size: "sm" | "md";
}) {
  const cls = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs";
  if (state === "done")
    return (
      <span
        className={`grid place-items-center rounded-full bg-green-600 text-white ${cls}`}
      >
        ✓
      </span>
    );
  if (state === "active")
    return (
      <span
        className={`grid place-items-center rounded-full bg-amber-500 font-bold text-white ${cls}`}
      >
        {order}
      </span>
    );
  if (state === "blocked")
    return (
      <span
        className={`grid place-items-center rounded-full bg-red-600 text-white ${cls}`}
      >
        ✕
      </span>
    );
  return (
    <span
      className={`grid place-items-center rounded-full border border-gray-300 bg-white font-medium text-gray-400 ${cls}`}
    >
      {order}
    </span>
  );
}

function Connector({ state }: { state: GateState }) {
  // The color of the connector to the NEXT gate reflects whether THIS
  // gate is complete (green) or otherwise (gray).
  const color =
    state === "done"
      ? "bg-green-500"
      : state === "blocked"
        ? "bg-red-300"
        : "bg-gray-200";
  return <span className={`mx-1 hidden h-px flex-1 ${color} sm:block`} />;
}

function textColor(state: GateState): string {
  if (state === "done") return "text-green-800";
  if (state === "active") return "text-amber-800";
  if (state === "blocked") return "text-red-800";
  return "text-gray-500";
}
