// Mobile pass: 375px-safe QR sizing, wrapping, and touch targets.
import { type FormEvent, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { registerDevice } from '../lib/services';
import { navigateToDeviceTimeline } from '../lib/routes';
import type { Device } from '../types/database';

type FormState = {
  brand: string;
  model: string;
  serialImei: string;
};

const initialFormState: FormState = {
  brand: '',
  model: '',
  serialImei: '',
};

export default function Register() {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registeredDevice, setRegisteredDevice] = useState<Device | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const qrValue = registeredDevice
    ? `${window.location.origin}/devices/${registeredDevice.id}`
    : '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const serialImei = form.serialImei.trim();
    const brand = form.brand.trim();
    const model = form.model.trim();

    setSubmitError(null);
    setFieldError(null);
    setRegisteredDevice(null);

    if (!serialImei) {
      setFieldError('Serial/IMEI is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const device = await registerDevice({
        device_type: 'phone',
        brand,
        model,
        serial_imei: serialImei,
      });

      setRegisteredDevice(device);
      setForm(initialFormState);
    } catch (error) {
      setSubmitError(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function downloadQrCode() {
    const canvas = qrCanvasRef.current;

    if (!canvas || !registeredDevice) {
      return;
    }

    const link = document.createElement('a');
    link.download = `repairpass-${registeredDevice.serial_imei}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-6 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-[#171717] sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:min-h-[calc(100vh-3rem)]">
        <header className="flex flex-col gap-6 border-b border-[#171717] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-[#171717]/60">
              RepairPass / Registration
            </p>
            <h1 className="mt-3 max-w-3xl font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-medium leading-none sm:text-6xl">
              Register device
            </h1>
          </div>
          <div className="min-h-11 w-fit border border-[#171717] px-3 py-2 text-sm">
            MVP-QR-01
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form
            className="flex flex-col border border-[#171717]"
            onSubmit={handleSubmit}
          >
            <div className="grid border-b border-[#171717] sm:grid-cols-2">
              <LockedField label="Device type" value="phone" />
              <InputField
                label="Brand"
                name="brand"
                placeholder="Apple"
                value={form.brand}
                onChange={(value) => updateField('brand', value)}
              />
            </div>

            <div className="grid border-b border-[#171717] sm:grid-cols-2">
              <InputField
                label="Model"
                name="model"
                placeholder="iPhone 15"
                value={form.model}
                onChange={(value) => updateField('model', value)}
              />
              <InputField
                label="Serial/IMEI"
                name="serialImei"
                placeholder="356938035643809"
                value={form.serialImei}
                error={fieldError}
                required
                onChange={(value) => updateField('serialImei', value)}
              />
            </div>

            <div className="flex flex-1 flex-col justify-between gap-8 p-4 sm:p-6">
              <StatusBlock
                submitError={submitError}
                registeredDevice={registeredDevice}
              />

              <button
                className="h-14 border border-[#171717] bg-[#171717] px-5 text-left text-sm font-medium uppercase text-[#FAFAFA] transition-colors hover:bg-[#21F1A8] hover:text-[#171717] disabled:cursor-not-allowed disabled:border-[#171717]/25 disabled:bg-[#171717]/10 disabled:text-[#171717]/40"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registering...' : 'Register and generate QR'}
              </button>
            </div>
          </form>

          <aside className="flex min-h-[420px] flex-col border border-[#171717]">
            <div className="border-b border-[#171717] px-4 py-3 text-xs font-medium uppercase text-[#171717]/60">
              Device label
            </div>

            <div className="flex flex-1 flex-col justify-between gap-6 p-4 sm:p-6">
              {registeredDevice ? (
                <>
                  <div className="border border-[#21F1A8] bg-white p-4">
                    <QRCodeCanvas
                      ref={qrCanvasRef}
                      value={qrValue}
                      size={320}
                      marginSize={2}
                      level="H"
                      className="h-auto max-w-full"
                    />
                  </div>

                  <div className="grid gap-2 text-sm">
                    <MetaRow label="Device ID" value={registeredDevice.id} />
                    <MetaRow label="QR link" value={qrValue} />
                    <MetaRow
                      label="Serial/IMEI"
                      value={registeredDevice.serial_imei}
                    />
                    <MetaRow
                      label="Device"
                      value={`${registeredDevice.brand} ${registeredDevice.model}`}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="h-12 border border-[#171717] px-4 text-left text-sm font-medium uppercase transition-colors hover:border-[#21F1A8] hover:bg-[#21F1A8]"
                      type="button"
                      onClick={downloadQrCode}
                    >
                      Download QR
                    </button>
                    <button
                      className="h-12 border border-[#171717] px-4 text-left text-sm font-medium uppercase transition-colors hover:border-[#21F1A8] hover:bg-[#21F1A8]"
                      type="button"
                      onClick={() => window.print()}
                    >
                      Print QR
                    </button>
                  </div>

                  <button
                    className="h-12 border border-[#171717] bg-[#171717] px-4 text-left text-sm font-medium uppercase text-[#FAFAFA] transition-colors hover:border-[#21F1A8] hover:bg-[#21F1A8] hover:text-[#171717]"
                    type="button"
                    onClick={() => navigateToDeviceTimeline(registeredDevice.id)}
                  >
                    View device history
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col justify-between">
                  <div className="aspect-square border border-dashed border-[#171717]/35" />
                  <p className="max-w-sm text-sm leading-6 text-[#171717]/60">
                    Submit a device to generate a QR label encoded with the
                    Supabase device ID.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

type InputFieldProps = {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  error?: string | null;
  required?: boolean;
  onChange: (value: string) => void;
};

function InputField({
  label,
  name,
  value,
  placeholder,
  error,
  required = false,
  onChange,
}: InputFieldProps) {
  return (
    <label className="flex min-h-36 flex-col gap-4 border-b border-[#171717] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-6">
      <span className="text-xs font-medium uppercase text-[#171717]/60">
        {label}
      </span>
      <input
        className="mt-auto w-full min-w-0 border-0 bg-transparent p-0 text-xl font-medium outline-none placeholder:text-[#171717]/25 focus:ring-0 sm:text-2xl"
        name={name}
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

type LockedFieldProps = {
  label: string;
  value: string;
};

function LockedField({ label, value }: LockedFieldProps) {
  return (
    <label className="flex min-h-36 flex-col gap-4 border-b border-[#171717] p-4 sm:border-b-0 sm:border-r sm:p-6">
      <span className="text-xs font-medium uppercase text-[#171717]/60">
        {label}
      </span>
      <input
        className="mt-auto w-full min-w-0 border-0 bg-transparent p-0 text-xl font-medium outline-none sm:text-2xl"
        value={value}
        disabled
        readOnly
      />
    </label>
  );
}

type StatusBlockProps = {
  submitError: string | null;
  registeredDevice: Device | null;
};

function StatusBlock({ submitError, registeredDevice }: StatusBlockProps) {
  if (submitError) {
    return (
      <div className="border border-red-700 p-4 text-sm leading-6 text-red-700">
        {submitError}
      </div>
    );
  }

  if (registeredDevice) {
    return (
      <div className="border border-[#21F1A8] p-4 text-sm leading-6">
        Device registered. QR label is ready for download or print.
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm leading-6 text-[#171717]/60 sm:grid-cols-3">
      <p>01 / Enter details</p>
      <p>02 / Register in Supabase</p>
      <p>03 / Attach QR label</p>
    </div>
  );
}

type MetaRowProps = {
  label: string;
  value: string;
};

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="grid gap-1 border-t border-[#171717] py-2">
      <span className="text-xs font-medium uppercase text-[#171717]/45">
        {label}
      </span>
      <span className="min-w-0 break-all font-medium">{value}</span>
    </div>
  );
}

function getRegisterErrorMessage(error: unknown): string {
  if (isObjectWithMessage(error)) {
    return error.message;
  }

  return 'Could not register device. Check the serial/IMEI and try again.';
}

function isObjectWithMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
