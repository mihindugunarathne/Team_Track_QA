"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { apiForm, apiRequest } from "@/lib/api";
import { storeSession } from "@/lib/auth";
import { fullName } from "@/lib/profileUi";
import { AdminUser, fileUrl } from "@/lib/types";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, refresh, isPlatformAdmin } = useAuth();
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [address, setAddress] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPlatformAdmin) {
      router.replace("/profile");
      return;
    }
    if (!user?.id) return;
    apiRequest<{ user: AdminUser }>(`/api/users/${user.id}`)
      .then((data) => {
        setProfile(data.user);
        setFirstName(data.user.firstName ?? "");
        setLastName(data.user.lastName ?? "");
        setBirthday(data.user.birthday ? String(data.user.birthday).slice(0, 10) : "");
        setAddress(data.user.address ?? "");
      })
      .catch((err) => setError(notifyError(err, "Unable to load profile.")))
      .finally(() => setLoading(false));
  }, [isPlatformAdmin, router, user?.id]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const name = fullName({ firstName, lastName }) || "Team member";
  const photoSrc = preview || fileUrl(profile?.profilePicture);
  const dirty = useMemo(() => {
    if (!profile) return Boolean(photo);
    return (
      firstName.trim() !== (profile.firstName ?? "").trim() ||
      lastName.trim() !== (profile.lastName ?? "").trim() ||
      birthday !== (profile.birthday ? String(profile.birthday).slice(0, 10) : "") ||
      address.trim() !== (profile.address ?? "").trim() ||
      Boolean(photo)
    );
  }, [address, birthday, firstName, lastName, photo, profile]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.id || !dirty) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError(notifyErrorMessage("First name and last name are required."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("firstName", firstName.trim());
      form.append("lastName", lastName.trim());
      form.append("birthday", birthday);
      form.append("address", address.trim());
      form.append("designation", profile?.designation ?? user.designation ?? "");
      if (photo) form.append("profilePicture", photo);
      const data = await apiForm<{ user: AdminUser }>(`/api/users/${user.id}`, form, "PATCH");
      storeSession({
        ...user,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        designation: data.user.designation,
        designations: data.user.designations,
        profileComplete: data.user.profileComplete,
      });
      await refresh();
      notifySuccess("Profile saved.");
      router.push("/profile");
    } catch (err) {
      setError(notifyError(err, "Unable to save profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        title="Edit profile"
        subtitle="Update your photo and personal details."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      <section className="card space-y-4 p-5">
        <p className="text-sm font-bold">Profile photo</p>
        <div className="flex items-center gap-4">
          <Avatar src={photoSrc} name={name} size={84} />
          <label className="btn-ghost cursor-pointer text-sm">
            Choose photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">First name</span>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Last name</span>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="field"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Birthday</span>
          <input
            type="date"
            value={birthday}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthday(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Address</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="field min-h-24"
            placeholder="Home address"
          />
        </label>
      </section>

      <button disabled={saving || !dirty} className="btn-primary disabled:pointer-events-none disabled:opacity-50">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
