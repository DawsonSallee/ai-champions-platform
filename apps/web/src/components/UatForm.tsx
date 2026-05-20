"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addUatEntryAction } from "@/domains/artifacts/actions";

export function UatForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState({
    testCaseId: "",
    phase: "InternalQA" as "InternalQA" | "BusinessUAT",
    scenario: "",
    dataUsed: "",
    expected: "",
    actual: "",
    result: "" as "" | "Pass" | "Fail" | "Blocked",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addUatEntryAction({
        projectId,
        testCaseId: state.testCaseId,
        phase: state.phase,
        scenario: state.scenario,
        dataUsed: state.dataUsed || undefined,
        expected: state.expected,
        actual: state.actual || undefined,
        result: state.result === "" ? undefined : state.result,
      });
      if (!res.ok) setError(res.error);
      else {
        setState({
          testCaseId: "",
          phase: state.phase,
          scenario: "",
          dataUsed: "",
          expected: "",
          actual: "",
          result: "",
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="card p-4 space-y-3 text-sm">
      <h3 className="section-title">Add UAT entry</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          className="input"
          placeholder="Test case ID (e.g. UAT-001)"
          value={state.testCaseId}
          onChange={(e) => setState({ ...state, testCaseId: e.target.value })}
        />
        <select
          className="input"
          value={state.phase}
          onChange={(e) =>
            setState({ ...state, phase: e.target.value as "InternalQA" | "BusinessUAT" })
          }
        >
          <option value="InternalQA">Internal QA</option>
          <option value="BusinessUAT">Business UAT</option>
        </select>
        <select
          className="input"
          value={state.result}
          onChange={(e) =>
            setState({ ...state, result: e.target.value as typeof state.result })
          }
        >
          <option value="">— result —</option>
          <option value="Pass">Pass</option>
          <option value="Fail">Fail</option>
          <option value="Blocked">Blocked</option>
        </select>
      </div>
      <input
        className="input"
        placeholder="Scenario"
        value={state.scenario}
        onChange={(e) => setState({ ...state, scenario: e.target.value })}
      />
      <input
        className="input"
        placeholder="Test data used"
        value={state.dataUsed}
        onChange={(e) => setState({ ...state, dataUsed: e.target.value })}
      />
      <input
        className="input"
        placeholder="Expected result"
        value={state.expected}
        onChange={(e) => setState({ ...state, expected: e.target.value })}
      />
      <input
        className="input"
        placeholder="Actual result"
        value={state.actual}
        onChange={(e) => setState({ ...state, actual: e.target.value })}
      />
      {error && <div className="text-red-600">{error}</div>}
      <button onClick={submit} disabled={pending} className="btn-primary">
        {pending ? "Adding…" : "Add entry"}
      </button>
    </div>
  );
}
