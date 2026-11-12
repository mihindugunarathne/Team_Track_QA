"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { IncrementRequest } from "@/lib/payroll";

const INPUT = "field h-11 rounded-[10px] px-3.5 text-[15px]";

export function EmployeeIncrementRequest() {
  const [requestedAmount, setRequestedAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [requests, setRequests] = useState<IncrementRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await apiRequest<{ requests: IncrementRequest[] }>("/api/payroll/requests");
    setRequests(data.requests ?? []);
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/payroll/requests", {
        method: "POST",
        body: JSON.stringify({ requestedAmount: Number(requestedAmount) || 0, reason, notes }),
      });
      notifySuccess("Request sent.");
      setRequestedAmount("");
      setReason("");
      setNotes("");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to send request."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-extrabold">Salary increment request</h2>
      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <input className={INPUT} type="number" min={0} step="0.01" placeholder="Requested amount" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} />
        <input className={INPUT} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <textarea className="field min-h-16 rounded-[10px] px-3.5 py-2" placeholder="Additional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary" disabled={busy} type="submit">Submit request</button>
      </form>
      <ul className="space-y-2 text-sm">
        {requests.map((item) => (
          <li key={item.id} className="rounded-xl border border-border px-3 py-2">
            {item.status} · {item.requestedAmount.toFixed(2)} · {item.reason}
            {item.adminComment ? <span className="block text-muted">{item.adminComment}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
