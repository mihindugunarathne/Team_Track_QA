import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { liveStateTone } from "@/lib/pmUi";
import { fileUrl, LiveBoard, LiveMember, LiveMemberState } from "@/lib/types";

const STATE_RANK: Record<LiveMemberState, number> = {
  working: 0,
  in_meeting: 1,
  on_hold: 2,
  on_break: 3,
  idle: 4,
  away: 5,
};

const PREVIEW_LIMIT = 6;

function memberName(member: LiveMember) {
  return `${member.user.firstName} ${member.user.lastName}`.trim() || member.user.email;
}

function activityLine(member: LiveMember) {
  if (member.break) {
    if (member.break.category === "meeting") {
      return member.break.note || "In a meeting";
    }
    return member.break.label || "On a break";
  }
  if (member.task) {
    if (member.state === "on_hold") {
      return member.task.holdReason
        ? `Paused · ${member.task.holdReason}`
        : `Paused · ${member.task.taskName}`;
    }
    return member.task.taskName;
  }
  if (member.leave) return "On leave";
  if (member.state === "idle") return "On shift · no timer";
  return "Away from work";
}

function previewMembers(board: LiveBoard) {
  return [...board.members]
    .filter((member) => member.state !== "away")
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state])
    .slice(0, PREVIEW_LIMIT);
}

export function LiveWorkSection({ board }: { board: LiveBoard | null }) {
  if (!board) return null;

  const people = previewMembers(board);
  const hidden = Math.max(
    0,
    board.members.filter((item) => item.state !== "away").length - people.length
  );
  const tiles = [
    { label: "Working", value: board.counts.working, color: "#1F9D6E" },
    { label: "Break", value: board.counts.onBreak ?? 0, color: "#C47A12" },
    { label: "Idle", value: board.counts.idle, color: "#1B6FEA" },
  ];
  if (board.counts.inMeeting) {
    tiles.splice(1, 0, {
      label: "Meeting",
      value: board.counts.inMeeting,
      color: "#7C3AED",
    });
  }
  if (board.counts.onHold) {
    tiles.push({ label: "Hold", value: board.counts.onHold, color: "#C47A12" });
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Live work</h2>
          <p className="text-sm text-muted">Who is on a timer right now</p>
        </div>
        <Link href="/live" className="shrink-0 text-sm font-bold text-primary">
          See all
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="min-w-[88px] flex-1 rounded-2xl bg-background px-3 py-2.5 text-center"
          >
            <p className="text-xl font-extrabold" style={{ color: tile.color }}>
              {tile.value}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-muted">{tile.label}</p>
          </div>
        ))}
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-muted">
          {board.officeHoursActive
            ? "Nobody is on a timer. People on shift will show here."
            : "Outside office hours. Live timers appear when the team is on shift."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {people.map((member) => {
            const name = memberName(member);
            const tone = liveStateTone(member.state);
            return (
              <li key={member.user.id}>
                <Link
                  href={`/timesheets/${member.user.id}`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-primary-soft/40"
                >
                  <span className="relative">
                    <Avatar
                      src={fileUrl(member.user.profilePicture)}
                      name={name}
                      size={36}
                    />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
                      style={{ background: tone.fg }}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{name}</span>
                    <span className="block truncate text-sm text-muted">
                      {activityLine(member)}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {tone.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 ? (
        <Link href="/live" className="mt-3 inline-block text-sm font-bold text-primary">
          +{hidden} more on the live board
        </Link>
      ) : null}
    </section>
  );
}
