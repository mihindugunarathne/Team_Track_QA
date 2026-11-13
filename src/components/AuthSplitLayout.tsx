import Image from "next/image";
import type { ReactNode } from "react";

type Feature = {
  icon: "users" | "chart" | "shield";
  label: string;
};

const DEFAULT_FEATURES: Feature[] = [
  { icon: "users", label: "Onboard your team" },
  { icon: "chart", label: "Track work & progress" },
  { icon: "shield", label: "Keep your data secure" },
];

type Props = {
  brandTitle: ReactNode;
  brandSubtitle: string;
  features?: Feature[];
  children: ReactNode;
};

export function AuthSplitLayout({
  brandTitle,
  brandSubtitle,
  features = DEFAULT_FEATURES,
  children,
}: Props) {
  return (
    <div className="auth-shell min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="auth-brand relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-10 lg:pb-0 lg:pt-10 xl:px-14">
        <div className="auth-brand-orb auth-brand-orb-a" aria-hidden />
        <div className="auth-brand-orb auth-brand-orb-b" aria-hidden />
        <div className="auth-brand-orb auth-brand-orb-c" aria-hidden />

        <div className="auth-brand-copy relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/logo3.png"
              alt="EmployeeTrack"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              EmployeeTrack
            </span>
          </div>

          <h1 className="auth-brand-title mt-8 max-w-lg text-[2.35rem] font-extrabold leading-[1.12] tracking-tight text-foreground xl:mt-10 xl:text-[2.65rem]">
            {brandTitle}
          </h1>
          <p className="mt-3 max-w-sm text-base font-medium leading-relaxed text-muted">
            {brandSubtitle}
          </p>
        </div>

        <div className="auth-brand-visual relative z-10 mt-2 flex min-h-0 flex-1 items-end justify-end">
          <div className="auth-hero-frame relative -mr-6 w-[118%] max-w-none xl:-mr-10 xl:w-[124%]">
            <Image
              src="/signin-hero.png"
              alt=""
              width={860}
              height={1080}
              className="auth-hero-image relative z-10 h-auto w-full object-contain object-bottom"
              priority
            />

            <div className="auth-feature-stack absolute left-[-2%] top-[58%] z-20 flex -translate-y-1/2 flex-col gap-3.5 xl:left-[1%]">
              {features.map((feature, index) => (
                <div
                  key={feature.label}
                  className="auth-feature-pill"
                  style={{ animationDelay: `${180 + index * 90}ms` }}
                >
                  <FeatureIcon name={feature.icon} />
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col bg-surface">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4 lg:hidden">
          <Image
            src="/logo3.png"
            alt="EmployeeTrack"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-base font-extrabold tracking-tight">EmployeeTrack</span>
        </div>

        <div className="flex flex-1 justify-center overflow-y-auto px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="auth-form-panel my-auto w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function AuthAccent({ children }: { children: ReactNode }) {
  return <span className="auth-accent-word">{children}</span>;
}

function FeatureIcon({ name }: { name: Feature["icon"] }) {
  if (name === "users") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.3M16.5 3.8a3.2 3.2 0 0 1 0 6.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 15v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 15V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 15v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 3.5v5.2c0 4.8-3.2 8.2-8 9.3-4.8-1.1-8-4.5-8-9.3V6.5L12 3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1l1.9 1.9 3.8-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
