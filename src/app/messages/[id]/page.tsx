"use client";

import { notifyError } from "@/lib/notify";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";

type Delivery = {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  recipientCount: number;
  audienceLabel?: string;
};

export default function MessageDetailPage() {
  const params = useParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    let cancelled = false;
    void apiRequest<{ delivery: Delivery }>(`/api/messages/deliveries/${id}`)
      .then((data) => {
        if (cancelled) return;
        if (!data.delivery) {
          setError("Message not found.");
          return;
        }
        setDelivery(data.delivery);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(notifyError(err, "Unable to open this message."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company message"
        title={delivery?.title ?? "Message"}
        subtitle={
          delivery
            ? `${new Date(delivery.sentAt).toLocaleString()} · ${delivery.audienceLabel ?? "Sent"} · ${
                delivery.recipientCount === 1 ? "1 person" : `${delivery.recipientCount} people`
              }`
            : "Opening the full message."
        }
        secondaryHref="/messages"
        secondaryLabel="All messages"
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {delivery ? (
        <article className="card whitespace-pre-wrap p-5 text-[15px] leading-7">{delivery.body}</article>
      ) : error ? (
        <Link href="/messages" className="text-sm font-bold text-primary">
          Back to messages
        </Link>
      ) : (
        <p className="text-sm text-muted">Loading…</p>
      )}
    </div>
  );
}
