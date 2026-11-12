"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiForm, apiRequest } from "@/lib/api";
import {
  idDocumentLabel,
  idDocumentStatus,
  idDocumentTone,
} from "@/lib/profileUi";
import { AdminUser, fileUrl } from "@/lib/types";

export default function IdentityPage() {
  const router = useRouter();
  const { user, refresh, isPlatformAdmin } = useAuth();
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (isPlatformAdmin) {
      router.replace("/profile");
      return;
    }
    if (!user?.id) return;
    apiRequest<{ user: AdminUser }>(`/api/users/${user.id}`)
      .then((data) => setProfile(data.user))
      .catch((err) => setError(notifyError(err, "Unable to load ID document.")))
      .finally(() => setLoading(false));
  }, [isPlatformAdmin, router, user?.id]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const existing = fileUrl(profile?.idCard);
  const shown = preview || existing;
  const status = file ? "uploaded" : idDocumentStatus(profile);
  const tone = idDocumentTone(status);

  async function save() {
    if (!user?.id || !file || !profile) return;
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const form = new FormData();
      form.append("birthday", profile.birthday ? String(profile.birthday).slice(0, 10) : "");
      form.append("address", profile.address ?? "");
      form.append("designation", profile.designation ?? "");
      form.append("idCard", file);
      const data = await apiForm<{ user: AdminUser }>(`/api/users/${user.id}`, form, "PATCH");
      setProfile(data.user);
      setFile(null);
      setSaved(notifySuccess("ID card uploaded."));
      await refresh();
    } catch (err) {
      setError(notifyError(err, "Unable to upload ID card."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity document"
        subtitle="Upload your ID card for admin verification."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">
          {saved}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">ID card</p>
            <p className="text-sm text-muted">
              {file ? "Ready to upload" : idDocumentLabel(status)}
            </p>
          </div>
          <StatusBadge label={idDocumentLabel(status)} bg={tone.bg} fg={tone.fg} />
        </div>

        {shown ? (
          <button type="button" onClick={() => setViewing(true)} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shown}
              alt="ID card"
              className="max-h-72 w-full rounded-2xl border border-border object-contain bg-background"
            />
          </button>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No ID card uploaded yet.
          </div>
        )}

        <label className="btn-ghost cursor-pointer text-sm">
          {shown ? "Replace photo" : "Choose photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </section>

      <button
        disabled={saving || !file}
        onClick={() => void save()}
        className="btn-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {saving ? "Uploading…" : "Save ID card"}
      </button>

      {viewing && shown ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
          onClick={() => setViewing(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="ID card" className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
        </div>
      ) : null}
    </div>
  );
}
