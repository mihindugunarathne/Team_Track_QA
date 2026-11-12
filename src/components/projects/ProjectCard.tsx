import Link from "next/link";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { projectStatusTone } from "@/lib/pmUi";
import { colors } from "@/lib/theme";
import { ProjectItem, projectStatusLabel } from "@/lib/types";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectCard({
  project,
  canManage,
  onDelete,
}: {
  project: ProjectItem;
  canManage?: boolean;
  onDelete?: () => void;
}) {
  const tone = projectStatusTone(project.status);
  const owner = project.owner
    ? `${project.owner.firstName} ${project.owner.lastName}`.trim()
    : "";
  const team = project.teamMembers?.length ?? 0;
  const due = formatDate(project.dueDate);
  const progress = project.progress ?? 0;
  const urgent = project.priority === "urgent" || project.priority === "high";

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Link href={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {(project.projectCode || project.name).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-extrabold leading-6 tracking-tight text-foreground">
              {project.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span>{project.client?.name || "No client"}</span>
              {project.projectCode ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span>{project.projectCode}</span>
                </>
              ) : null}
              {owner ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span>{owner}</span>
                </>
              ) : null}
              <span
                className="inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {projectStatusLabel(project.status)}
              </span>
              {urgent ? (
                <span
                  className="inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold"
                  style={{ background: colors.warningSoft, color: colors.warning }}
                >
                  {project.priority === "urgent" ? "Urgent" : "High"}
                </span>
              ) : null}
            </div>
            {project.description ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{project.description}</p>
            ) : null}
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-1 sm:justify-end">
          <Link
            href={`/projects/${project.id}`}
            className="btn-primary"
          >
            Open
          </Link>
          {canManage ? (
            <>
              <Link
                href={`/projects/new?projectId=${project.id}`}
                className="btn-ghost"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={onDelete}
                className="btn-danger"
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-48 flex-1">
            <p className="mb-1.5 text-[12px] font-semibold text-muted">Progress</p>
            <ProgressBar value={progress} />
            <p className="mt-1.5 text-[12px] text-muted">
              {progress}% · {project.completedTaskCount ?? 0}/{project.taskCount ?? 0} tasks
              {team ? ` · ${team} on the team` : ""}
            </p>
          </div>
          {due ? (
            <p className="text-[13px] font-semibold text-muted">Due {due}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
