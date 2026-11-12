import { initials } from "@/lib/pmUi";

export function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name?: string;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.28)) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="rounded-full object-cover"
        style={style}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary"
      style={style}
    >
      {initials(name)}
    </div>
  );
}
