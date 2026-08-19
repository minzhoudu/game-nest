import type { EnvVarSchema } from '@gamenest/shared-types';

interface EnvVarFieldProps {
  field: EnvVarSchema;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Renders one Advanced Options field per its schema `type` — see
 * packages/shared-types/src/entities.ts for why select/range exist (so a
 * user picks from real, working values instead of guessing at free text).
 */
export function EnvVarField({ field, value, onChange }: EnvVarFieldProps) {
  const id = `env-${field.key}`;

  if (field.type === 'boolean') {
    return (
      <label className="field-checkbox">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(String(e.target.checked))} />
        {field.label}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="field">
        <label htmlFor={id}>{field.label}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.description && <p className="field-hint">{field.description}</p>}
      </div>
    );
  }

  if (field.type === 'range') {
    // Value is stored as e.g. "3G" (see resolve-env.ts) — parseInt happily
    // stops at the first non-digit, so this recovers the slider position.
    const numericValue = Number.parseInt(value, 10) || field.min || 0;
    return (
      <div className="field">
        <label htmlFor={id}>
          {field.label}:{' '}
          <strong>
            {numericValue}
            {field.unit}
          </strong>
        </label>
        <input
          id={id}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={numericValue}
          onChange={(e) => onChange(`${e.target.value}${field.unit ?? ''}`)}
        />
        {field.description && <p className="field-hint">{field.description}</p>}
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      <input
        id={id}
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.description && <p className="field-hint">{field.description}</p>}
    </div>
  );
}
