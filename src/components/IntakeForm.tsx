import { useState, type FormEvent } from 'react';
import type { RecordIntake } from '../core/types';
import { Dialog } from './Dialog';

export function IntakeForm({
  intake,
  onSubmit,
  onClose,
}: {
  intake: RecordIntake;
  onSubmit: (values: Record<string, string>) => string | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(intake.fields.map((field) => [field.key, ''])),
  );
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = onSubmit(values);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Dialog title={intake.title} subtitle="NEW REQUEST" onClose={onClose}>
      <form className="vendor-form" onSubmit={submit} noValidate>
        {intake.fields.map((field) => {
          const props = {
            value: values[field.key],
            required: field.required,
            maxLength: field.maxLength,
            'aria-describedby': field.help ? `intake-${field.key}-help` : undefined,
            onChange: (event: { target: { value: string } }) =>
              setValues((current) => ({ ...current, [field.key]: event.target.value })),
          };
          return (
            <label key={field.key}>
              {field.label}
              {!field.required && ' (optional)'}
              {field.type === 'textarea' ? (
                <textarea {...props} />
              ) : field.type === 'select' ? (
                <select {...props}>
                  <option value="">Choose…</option>
                  {field.options?.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input type={field.type === 'date' ? 'date' : 'text'} {...props} />
              )}
              {field.help && (
                <span id={`intake-${field.key}-help`} className="subtle">
                  {field.help}
                </span>
              )}
            </label>
          );
        })}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-buttons">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary">{intake.label}</button>
        </div>
      </form>
    </Dialog>
  );
}
