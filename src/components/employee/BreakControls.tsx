"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBreakDuration, formatClock } from "@/lib/employee";
import { colors } from "@/lib/theme";
import { BreakPolicy, BreakRuleStatus } from "@/lib/types";

type Props = {
  policy: BreakPolicy | null;
  busy?: boolean;
  /** Show only the live banner, for screens that should not offer new breaks. */
  bannerOnly?: boolean;
  onStart: (input: {
    breakKey?: string;
    category?: "break" | "meeting";
    note?: string;
    scheduledMeetingId?: string;
  }) => void;
  onEnd: () => void;
};

/**
 * Mirrors the mobile break bar: pick a break to pause every running task timer,
 * then end it to start them again. Out-of-window breaks are allowed but confirm
 * first so the flag is never a surprise.
 */
export function BreakControls({
  policy,
  busy = false,
  bannerOnly = false,
  onStart,
  onEnd,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmRule, setConfirmRule] = useState<BreakRuleStatus | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingNote, setMeetingNote] = useState("");

  const open = policy?.open ?? null;
  const liveMeeting = policy?.liveMeeting ?? null;

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const elapsedMs = useMemo(() => {
    if (!open) return 0;
    return Math.max(0, now - new Date(open.startedAt).getTime());
  }, [now, open]);

  if (!policy) return null;

  if (open) {
    const scheduled = Boolean(open.scheduledMeetingId);
    const overrunMs =
      open.category === "meeting"
        ? 0
        : Math.max(0, elapsedMs - Math.max(0, open.allowanceMs));
    const accent = overrunMs > 0 ? colors.error : colors.warning;
    return (
      <section
        className="card space-y-2 p-[18px]"
        style={{ borderColor: `${accent}55` }}
      >
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
          {open.category === "meeting" ? "In a meeting" : `On ${open.label.toLowerCase()}`}
        </p>
        <p className="text-[32px] font-bold tabular-nums" style={{ color: accent }}>
          {formatClock(elapsedMs)}
        </p>
        <p className="text-sm text-muted">
          {open.category === "meeting"
            ? scheduled
              ? `Task timers stay paused until ${liveMeeting?.endTime ?? "the meeting ends"}. Meeting time still counts as work.`
              : "Meeting time counts as work. Your task timers are paused."
            : open.allowanceMs <= 0
              ? `${formatBreakDuration(elapsedMs)} of unpaid break time`
              : overrunMs > 0
                ? `${formatBreakDuration(overrunMs)} over your ${formatBreakDuration(
                    open.allowanceMs
                  )} allowance`
                : `${formatBreakDuration(
                    Math.max(0, open.allowanceMs - elapsedMs)
                  )} of ${formatBreakDuration(open.allowanceMs)} left`}
        </p>
        {open.outsideWindow ? (
          <p className="text-xs font-bold text-error">
            Started outside the scheduled window
          </p>
        ) : null}
        {liveMeeting && !liveMeeting.joined ? (
          <p className="text-xs font-semibold text-muted">
            End this break to join “{liveMeeting.title}”. Tasks will stay paused for the meeting.
          </p>
        ) : null}
        <button
          type="button"
          className="btn-primary w-full"
          onClick={onEnd}
          disabled={busy}
        >
          {scheduled
            ? "Leave meeting"
            : open.pausedTaskCount
              ? "I'm back — resume work"
              : "I'm back"}
        </button>
      </section>
    );
  }

  function joinBanner() {
    if (!liveMeeting || liveMeeting.joined) return null;
    return (
      <section className="card space-y-3 p-[18px]" style={{ borderColor: `${colors.primary}55` }}>
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Scheduled meeting
        </p>
        <p className="text-lg font-bold">{liveMeeting.title}</p>
        <p className="text-sm text-muted">
          {liveMeeting.left
            ? `You left this meeting. Rejoin to pause your task timers until ${liveMeeting.endTime}. Meeting time still counts as work.`
            : `${liveMeeting.startTime}–${liveMeeting.endTime}. Join to pause your task timers until
          the meeting ends. Meeting time still counts as work.`}
        </p>
        {policy?.onShift ? (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() =>
              onStart({
                category: "meeting",
                scheduledMeetingId: liveMeeting.id,
              })
            }
            disabled={busy}
          >
            {liveMeeting.left ? "Rejoin meeting" : "Join meeting"}
          </button>
        ) : (
          <p className="text-xs font-semibold text-muted">Join when your shift starts.</p>
        )}
      </section>
    );
  }

  if (bannerOnly || !policy.onShift) return joinBanner();

  return (
    <div className="space-y-3">
      {joinBanner()}
      <section className="card space-y-3 p-[18px]">
      <h2 className="text-base font-bold">Lunch, tea & quick meeting</h2>
      <p className="text-sm text-muted">From company break settings. Tap to start; your task timers pause until you are back.</p>
      <div className="flex flex-wrap gap-2">
        {policy.rules.map((rule) => (
          <button
            type="button"
            key={rule.key}
            onClick={() =>
              rule.windowOpen ? onStart({ breakKey: rule.key }) : setConfirmRule(rule)
            }
            disabled={busy || rule.exhausted}
            className={`min-h-12 rounded-xl border px-3 py-2 text-left disabled:opacity-45 ${
              rule.windowOpen && !rule.exhausted
                ? "border-primary-soft bg-primary-soft"
                : "border-border bg-surface"
            }`}
          >
            <span className="block text-[13px] font-bold">
              {rule.label} · {formatBreakDuration(rule.durationMinutes * 60_000)}
            </span>
            <span className="block text-[11px] text-muted">
              {rule.exhausted
                ? "Already taken"
                : rule.windowOpen
                  ? `${formatBreakDuration(rule.remainingMs)} left`
                  : rule.windowLabel}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMeetingOpen(true)}
          disabled={busy}
          className="min-h-12 rounded-xl border border-border bg-surface px-3 py-2 text-left disabled:opacity-45"
        >
          <span className="block text-[13px] font-bold">Quick meeting</span>
          <span className="block text-[11px] text-muted">Pauses tasks · counts as work</span>
        </button>
      </div>

      {confirmRule ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          onClick={() => setConfirmRule(null)}
        >
          <div
            className="card w-full max-w-md space-y-4 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {confirmRule.label} is outside its window
            </h3>
            <p className="text-[15px] leading-6 text-muted">
              {confirmRule.label} is scheduled for {confirmRule.windowLabel}. You can
              still take it now, but it will be flagged for your admin.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmRule(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const rule = confirmRule;
                  setConfirmRule(null);
                  onStart({ breakKey: rule.key });
                }}
              >
                Take it anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {meetingOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          onClick={() => setMeetingOpen(false)}
        >
          <div
            className="card w-full max-w-md space-y-4 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Start a meeting</h3>
            <p className="text-[15px] leading-6 text-muted">
              Your task timers pause while you are in the meeting, and the meeting
              time still counts as work.
            </p>
            <input
              className="field"
              value={meetingNote}
              onChange={(event) => setMeetingNote(event.target.value)}
              placeholder="What is the meeting about? (optional)"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setMeetingOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const note = meetingNote.trim();
                  setMeetingNote("");
                  setMeetingOpen(false);
                  onStart({ category: "meeting", note });
                }}
              >
                Start meeting
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
    </div>
  );
}
