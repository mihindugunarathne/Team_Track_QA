"use client";

import { useState } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
};

export function PasswordField({
  label,
  value,
  onChange,
  placeholder = "Password",
  autoComplete,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field pr-12"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.4" />
      <path d="M6.1 6.1C3.9 7.6 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.4-1" />
    </svg>
  );
}
