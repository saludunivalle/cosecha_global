'use client';

interface ViewToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ViewToggle({ checked, onChange }: ViewToggleProps) {
  return (
    <div className="view-switch-container">
      <label>Por Periodo</label>
      <label className="switch">
        <input
          type="checkbox"
          id="viewToggle"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="slider"></span>
      </label>
      <label>Por Actividad</label>
    </div>
  );
}

