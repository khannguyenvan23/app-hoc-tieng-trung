"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";

export type AudioSpeedValue = "normal" | "slow";

const speedOptions: Array<{
  description: string;
  label: string;
  value: AudioSpeedValue;
}> = [
  {
    description: "Tốc độ tự nhiên · 1x",
    label: "Bình thường",
    value: "normal",
  },
  {
    description: "Nghe rõ từng âm · 0.75x",
    label: "Nghe chậm",
    value: "slow",
  },
];

export function AudioSpeedMenu({
  className = "",
  onChange,
  value,
}: {
  className?: string;
  onChange: (value: AudioSpeedValue) => void;
  value: AudioSpeedValue;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const selectedOption = speedOptions.find((option) => option.value === value);

  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        menuRef.current?.removeAttribute("open");
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        menuRef.current?.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function selectSpeed(nextValue: AudioSpeedValue) {
    onChange(nextValue);
    menuRef.current?.removeAttribute("open");
  }

  return (
    <details className={`audio-speed-menu ${className}`} ref={menuRef}>
      <summary
        aria-label={`Tốc độ audio: ${selectedOption?.label ?? "Bình thường"}`}
        className="audio-speed-trigger"
        title={`Tốc độ audio: ${selectedOption?.label ?? "Bình thường"}`}
      >
        <Icon name="audio" size={19} />
        <span aria-hidden="true" className="audio-speed-indicator">
          {value === "slow" ? "0.75×" : "1×"}
        </span>
      </summary>

      <div className="audio-speed-panel">
        <div className="audio-speed-heading">Tốc độ audio</div>
        {speedOptions.map((option) => {
          const selected = option.value === value;

          return (
            <button
              aria-pressed={selected}
              className={`audio-speed-menu-option ${selected ? "audio-speed-menu-option-active" : ""}`}
              key={option.value}
              onClick={() => selectSpeed(option.value)}
              type="button"
            >
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              {selected ? <Icon name="check" size={17} /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
