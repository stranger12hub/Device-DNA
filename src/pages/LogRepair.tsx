// Mobile pass: stacked repair fields and 44px-safe controls.
import { type FormEvent, useState } from 'react';
import { logRepair } from '../lib/services';
import { getCurrentRoute, navigateToDeviceTimeline } from '../lib/routes';

type LogRepairProps = {
  deviceId?: string;
  onRepairLogged?: () => void;
};

type FormState = {
  symptom: string;
  diagnosis: string;
  actionTaken: string;
  partName: string;
  isGenuine: boolean;
  partWarrantyDays: string;
};

const initialFormState: FormState = {
  symptom: '',
  diagnosis: '',
  actionTaken: '',
  partName: '',
  isGenuine: true,
  partWarrantyDays: '',
};

export default function LogRepair({ deviceId, onRepairLogged }: LogRepairProps) {
  const route = getCurrentRoute();
  const selectedDeviceId =
    deviceId ??
    (route.name === 'timeline' || route.name === 'logRepair'
      ? route.deviceId
      : '');
  const [form, setForm] = useState<FormState>(initialFormState);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const symptom = form.symptom.trim();
    const diagnosis = form.diagnosis.trim();
    const actionTaken = form.actionTaken.trim();
    const partName = form.partName.trim();
    const partWarrantyDays = Number(form.partWarrantyDays || 0);

    setFieldError(null);
    setSubmitError(null);
    setSuccessMessage(null);

    if (!symptom) {
      setFieldError('Symptom is required.');
      return;
    }

    if (
      form.partWarrantyDays.trim() &&
      (!Number.isFinite(partWarrantyDays) || partWarrantyDays < 0)
    ) {
      setFieldError('Warranty days must be a non-negative number.');
      return;
    }

    setIsSubmitting(true);

    try {
      await logRepair({
        deviceId: selectedDeviceId,
        symptom,
        diagnosis: diagnosis || null,
        actionTaken,
        parts: partName
          ? [
              {
                partName,
                isGenuine: form.isGenuine,
                warrantyDays: partWarrantyDays,
              },
            ]
          : [],
      });

      setForm(initialFormState);
      setSuccessMessage('Repair logged.');
      onRepairLogged?.();

      if (!deviceId) {
        navigateToDeviceTimeline(selectedDeviceId);
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<FieldName extends keyof FormState>(
    field: FieldName,
    value: FormState[FieldName],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="border border-[#171717]" onSubmit={handleSubmit}>
      <div className="border-b border-[#171717] px-4 py-3 text-xs font-medium uppercase text-[#171717]/60 sm:px-5">
        Log repair
      </div>

      <div className="grid sm:grid-cols-2">
        <InputField
          label="Symptom"
          name="symptom"
          value={form.symptom}
          placeholder="Screen flickering"
          error={fieldError}
          required
          onChange={(value) => updateField('symptom', value)}
        />
        <InputField
          label="Diagnosis"
          name="diagnosis"
          value={form.diagnosis}
          placeholder="Loose display connector"
          onChange={(value) => updateField('diagnosis', value)}
        />
      </div>

      <div className="grid border-t border-[#171717] sm:grid-cols-2 lg:grid-cols-4">
        <InputField
          label="Action taken"
          name="actionTaken"
          value={form.actionTaken}
          placeholder="Reseated connector"
          onChange={(value) => updateField('actionTaken', value)}
        />
        <InputField
          label="Part name"
          name="partName"
          value={form.partName}
          placeholder="OLED display"
          onChange={(value) => updateField('partName', value)}
        />
        <ToggleField
          label="Part origin"
          checked={form.isGenuine}
          onChange={(checked) => updateField('isGenuine', checked)}
        />
        <InputField
          label="Warranty days"
          name="partWarrantyDays"
          type="number"
          value={form.partWarrantyDays}
          placeholder="90"
          min={0}
          onChange={(value) => updateField('partWarrantyDays', value)}
        />
      </div>

      <div className="grid gap-4 border-t border-[#171717] p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
        <StatusMessage error={submitError} success={successMessage} />
        <button
          className="h-12 border border-[#171717] bg-[#171717] px-4 text-left text-sm font-medium uppercase text-[#FAFAFA] transition-colors hover:bg-[#FAFAFA] hover:text-[#171717] disabled:cursor-not-allowed disabled:border-[#171717]/25 disabled:bg-[#171717]/10 disabled:text-[#171717]/40"
          type="submit"
          disabled={isSubmitting || !selectedDeviceId}
        >
          {isSubmitting ? 'Logging...' : 'Log repair'}
        </button>
      </div>
    </form>
  );
}

type InputFieldProps = {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  error?: string | null;
  required?: boolean;
  type?: 'text' | 'number';
  min?: number;
  onChange: (value: string) => void;
};

function InputField({
  label,
  name,
  value,
  placeholder,
  error,
  required = false,
  type = 'text',
  min,
  onChange,
}: InputFieldProps) {
  return (
    <label className="flex min-h-32 flex-col gap-4 border-b border-[#171717] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-5">
      <span className="text-xs font-medium uppercase text-[#171717]/60">
        {label}
      </span>
      <input
        className="mt-auto w-full min-w-0 border-0 bg-transparent p-0 text-lg font-medium outline-none placeholder:text-[#171717]/25 focus:ring-0 sm:text-xl"
        name={name}
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type ToggleFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleField({ label, checked, onChange }: ToggleFieldProps) {
  return (
    <label className="flex min-h-32 flex-col gap-4 border-b border-[#171717] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-5">
      <span className="text-xs font-medium uppercase text-[#171717]/60">
        {label}
      </span>
      <button
        className="mt-auto grid min-h-12 grid-cols-2 border border-[#171717] text-sm font-medium uppercase"
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span
          className={[
            'grid place-items-center border-r border-[#171717]',
            checked ? 'bg-[#171717] text-[#FAFAFA]' : 'bg-transparent',
          ].join(' ')}
        >
          Genuine
        </span>
        <span
          className={[
            'grid place-items-center',
            !checked ? 'bg-[#171717] text-[#FAFAFA]' : 'bg-transparent',
          ].join(' ')}
        >
          Other
        </span>
      </button>
    </label>
  );
}

type StatusMessageProps = {
  error: string | null;
  success: string | null;
};

function StatusMessage({ error, success }: StatusMessageProps) {
  if (error) {
    return <p className="text-sm leading-6 text-red-700">{error}</p>;
  }

  if (success) {
    return <p className="text-sm leading-6 text-[#171717]">{success}</p>;
  }

  return (
    <p className="text-sm leading-6 text-[#171717]/60">
      Repairs are appended to the device history and newest entries appear first.
    </p>
  );
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Could not log repair. Check the details and try again.';
}
