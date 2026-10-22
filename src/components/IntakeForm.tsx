import { Fragment, useState, type FormEvent } from 'react';
import type { ToolIntake } from '../core/types';
import { Dialog } from './Dialog';

export function IntakeForm({
  intake,
  title,
  onSubmit,
  onClose,
}: {
  intake: ToolIntake;
  title: string;
  onSubmit: (values: Record<string, string>) => string | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(intake.fields.map((field) => [field.key, ''])),
  );
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    setError(onSubmit(values) ?? '');
  }
  return (
    <Dialog title={intake.label} subtitle={title.toUpperCase()} onClose={onClose}>
      <form className="vendor-form" onSubmit={submit} noValidate>
        <p>{intake.description}</p>
        {intake.fields.map((field) => {
          const props = {
            value: values[field.key],
            required: !field.optional,
            maxLength: field.maxLength ?? (field.kind === 'textarea' ? 1000 : 120),
            placeholder: field.placeholder,
            'aria-describedby': field.hint ? `intake-${field.key}-hint` : undefined,
            onChange: (event: { target: { value: string } }) =>
              setValues((current) => ({ ...current, [field.key]: event.target.value })),
          };
          return (
            <Fragment key={field.key}>
              <label>
                {field.label}
                {field.optional && <span className="subtle"> (optional)</span>}
                {field.kind === 'textarea' ? (
                  <textarea {...props} />
                ) : field.kind === 'select' ? (
                  <select {...props}>
                    <option value="">Choose…</option>
                    {field.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input type={field.kind === 'date' ? 'date' : 'text'} {...props} />
                )}
              </label>
              {field.hint && (
                <p id={`intake-${field.key}-hint`} className="subtle">
                  {field.hint}
                </p>
              )}
            </Fragment>
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
