import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/** 6-digit PIN entry with hidden characters, keyboard + click, auto-submit on fill. */
export function PinInput({
  length = 6,
  onComplete,
  disabled,
}: {
  length?: number;
  onComplete: (pin: string) => void;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const doneRef = useRef(false);

  useEffect(() => {
    setDigits(Array(length).fill(""));
    doneRef.current = false;
  }, [length]);

  useEffect(() => {
    const filled = digits.every((digit) => digit !== "");
    if (filled && !doneRef.current) {
      doneRef.current = true;
      onComplete(digits.join(""));
    }
    if (!filled) doneRef.current = false;
  }, [digits, onComplete]);

  const push = (digit: string) => {
    setDigits((current) => {
      const next = [...current];
      const index = next.findIndex((d) => d === "");
      if (index === -1) return current;
      next[index] = digit;
      return next;
    });
  };
  const pop = () =>
    setDigits((current) => {
      const next = [...current];
      let index = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i] !== "") { index = i; break; }
      }
      if (index === -1) return current;
      next[index] = "";
      return next;
    });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (disabled) return;
      if (/^[0-9]$/.test(event.key)) push(event.key);
      else if (event.key === "Backspace") pop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [digits, disabled]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2" role="group" aria-label="PIN entry">
        {digits.map((digit, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              "flex h-10 w-8 items-center justify-center rounded-input border border-border bg-surface",
              digit && "border-primary",
            )}
          >
            {digit ? "•" : ""}
          </span>
        ))}
      </div>
      <span className="sr-only" role="status">{`${digits.filter(Boolean).length} of ${length} digits entered`}</span>
      <div className="grid grid-cols-3 gap-2" aria-hidden={disabled}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <PadButton key={digit} onClick={() => push(digit)} disabled={disabled}>
            {digit}
          </PadButton>
        ))}
        <PadButton onClick={pop} disabled={disabled} aria-label="Backspace">
          <Delete size={18} aria-hidden />
        </PadButton>
        <PadButton onClick={() => push("0")} disabled={disabled}>
          0
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 w-14 rounded-card border border-border bg-surface text-h3 font-medium tnum",
        "hover:bg-surface-2 active:scale-95 transition-transform",
        "disabled:opacity-50",
      )}
    >
      {children}
    </button>
  );
}
