"use client";

import { Icon } from "@/components/icons";

export type StudyModeOption = {
  description: string;
  enabled: boolean;
  id: string;
  label: string;
  onToggle: () => void;
};

export function StudyModeMenu({
  className = "",
  options,
}: {
  className?: string;
  options: StudyModeOption[];
}) {
  const activeCount = options.filter((option) => option.enabled).length;

  return (
    <details className={`study-mode-menu ${className}`}>
      <summary className="study-mode-trigger">
        <Icon name="settings" size={17} />
        <span>Tùy chọn</span>
        {activeCount > 0 ? (
          <span
            aria-label={`${activeCount} chế độ đang bật`}
            className="study-mode-count"
          >
            {activeCount}
          </span>
        ) : null}
      </summary>

      <div className="study-mode-panel">
        <div className="study-mode-heading">
          <strong>Chế độ học</strong>
          <span>Bật những hỗ trợ bạn cần</span>
        </div>

        <div className="study-mode-options">
          {options.map((option) => (
            <label className="study-mode-row" key={option.id}>
              <span className="min-w-0">
                <span className="study-mode-label">{option.label}</span>
                <span className="study-mode-description">
                  {option.description}
                </span>
              </span>
              <input
                checked={option.enabled}
                className="sr-only"
                onChange={option.onToggle}
                type="checkbox"
              />
              <span aria-hidden="true" className="study-mode-switch">
                <span />
              </span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
