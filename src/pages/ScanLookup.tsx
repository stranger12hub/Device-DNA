// Home UI: professional two-card entry with scanner/manual lookup shown on demand.
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { lookupDeviceBySerial } from '../lib/services';
import { parseDeviceTimelineCode } from '../lib/deviceLinks';
import { navigateToDeviceTimeline, navigateToRegister } from '../lib/routes';

const scannerElementId = 'repairpass-qr-scanner';
const scannerConfig = {
  fps: 10,
  qrbox: { width: 240, height: 240 },
  aspectRatio: 1,
};

export default function ScanLookup() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const [serialImei, setSerialImei] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function startScanner() {
      setIsScannerStarting(true);
      setCameraError(null);
      hasScannedRef.current = false;

      try {
        const scanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = scanner;

        await startWithCameraFallback(scanner, handleScanSuccess);

        if (isMounted) {
          setIsScannerStarting(false);
        }
      } catch (error) {
        console.error('QR scanner unavailable:', error);

        if (isMounted) {
          setCameraError('Camera unavailable. Use manual lookup instead.');
          setIsScannerStarting(false);
        }
      }
    }

    if (isLookupOpen) {
      void startScanner();
    }

    return () => {
      isMounted = false;
      void stopScanner();
    };
  }, [isLookupOpen]);

  function handleScanSuccess(decodedText: string) {
    if (hasScannedRef.current) {
      return;
    }

    hasScannedRef.current = true;
    void stopScanner();
    navigateToDeviceTimeline(parseDeviceTimelineCode(decodedText));
  }

  async function stopScanner() {
    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    scannerRef.current = null;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (error) {
      console.error('QR scanner cleanup failed:', error);
    }
  }

  async function handleManualLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const serial = serialImei.trim();

    setManualError(null);

    if (!serial) {
      setManualError('Serial/IMEI is required.');
      return;
    }

    setIsLookingUp(true);

    try {
      const device = await lookupDeviceBySerial(serial);

      if (!device) {
        setManualError('Device not found.');
        return;
      }

      navigateToDeviceTimeline(device.id);
    } catch (error) {
      console.error('Manual lookup failed:', error);
      setManualError('Device not found.');
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-6 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-[#171717] sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:min-h-[calc(100vh-3rem)]">
        <header className="flex flex-col gap-6 border-b border-[#171717] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-[#171717]/60">
              RepairPass
            </p>
            <h1 className="mt-3 max-w-3xl font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-medium leading-none sm:text-6xl">
              Device service records
            </h1>
          </div>
          <div className="min-h-11 w-fit border border-[#171717] px-3 py-2 text-sm">
            SECURE LOOKUP
          </div>
        </header>

        {!isLookupOpen ? (
          <section className="grid gap-6 md:grid-cols-2">
            <EntryCard
              eyebrow="Create record"
              title="Device Enrollment"
              body="Add a handset to RepairPass and generate its service label."
              action="Start enrollment"
              onClick={navigateToRegister}
            />
            <EntryCard
              eyebrow="Open record"
              title="Service History Lookup"
              body="Scan a RepairPass label or enter the Serial/IMEI to view prior work."
              action="Open lookup"
              onClick={() => setIsLookupOpen(true)}
            />
          </section>
        ) : (
          <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <section className="flex min-h-[420px] flex-col border border-[#171717]">
              <div className="border-b border-[#171717] px-4 py-3 text-xs font-medium uppercase text-[#171717]/60">
                Camera lookup
              </div>

              <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                <div className="relative min-h-[260px] overflow-hidden border border-[#171717] bg-white sm:min-h-[320px]">
                  <div
                    id={scannerElementId}
                    className="min-h-[260px] max-w-full overflow-hidden sm:min-h-[320px] [&_button]:min-h-11 [&_button]:border [&_button]:border-[#171717] [&_button]:bg-[#FAFAFA] [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-medium [&_button]:uppercase [&_select]:max-w-full [&_select]:border [&_select]:border-[#171717] [&_select]:bg-[#FAFAFA] [&_select]:p-2 [&_video]:max-w-full"
                  />
                  {isScannerStarting ? (
                    <div className="absolute inset-0 grid place-items-center bg-[#FAFAFA] text-sm text-[#171717]/60">
                      Starting camera...
                    </div>
                  ) : null}
                </div>

                {cameraError ? (
                  <p className="border border-[#171717]/25 p-4 text-sm leading-6 text-[#171717]/60">
                    {cameraError}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-[#171717]/60">
                    Point the camera at a RepairPass label to open the device
                    timeline.
                  </p>
                )}
              </div>
            </section>

            <form
              className="flex min-h-[420px] flex-col border border-[#171717]"
              onSubmit={handleManualLookup}
            >
              <div className="border-b border-[#171717] px-4 py-3 text-xs font-medium uppercase text-[#171717]/60">
                Serial lookup
              </div>

              <div className="flex flex-1 flex-col justify-between gap-8 p-4 sm:p-6">
                <label className="flex min-h-40 flex-col gap-4 border-b border-[#171717] pb-6">
                  <span className="text-xs font-medium uppercase text-[#171717]/60">
                    Serial/IMEI
                  </span>
                  <input
                    className="mt-auto w-full min-w-0 border-0 bg-transparent p-0 text-xl font-medium outline-none placeholder:text-[#171717]/25 focus:ring-0 sm:text-2xl"
                    name="serialImei"
                    value={serialImei}
                    placeholder="356938035643809"
                    aria-invalid={Boolean(manualError)}
                    aria-describedby={
                      manualError ? 'manual-lookup-error' : undefined
                    }
                    onChange={(event) => setSerialImei(event.target.value)}
                  />
                </label>

                <div className="grid gap-4">
                  {manualError ? (
                    <p
                      id="manual-lookup-error"
                      className="border border-red-700 p-4 text-sm leading-6 text-red-700"
                    >
                      {manualError}
                    </p>
                  ) : (
                    <p className="text-sm leading-6 text-[#171717]/60">
                      Use serial lookup when a label is damaged, missing, or
                      camera access is unavailable.
                    </p>
                  )}

                  <button
                    className="h-14 border border-[#171717] bg-[#171717] px-5 text-left text-sm font-medium uppercase text-[#FAFAFA] transition-colors hover:bg-[#FAFAFA] hover:text-[#171717] disabled:cursor-not-allowed disabled:border-[#171717]/25 disabled:bg-[#171717]/10 disabled:text-[#171717]/40"
                    type="submit"
                    disabled={isLookingUp}
                  >
                    {isLookingUp ? 'Looking up...' : 'Find record'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

type EntryCardProps = {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
};

function EntryCard({ eyebrow, title, body, action, onClick }: EntryCardProps) {
  return (
    <article className="flex min-h-80 flex-col justify-between border border-[#171717] p-5 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase text-[#171717]/60">
          {eyebrow}
        </p>
        <h2 className="mt-6 font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-3xl font-medium leading-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-6 text-[#171717]/60">
          {body}
        </p>
      </div>
      <button
        className="mt-8 h-14 border border-[#171717] bg-[#171717] px-5 text-left text-sm font-medium uppercase text-[#FAFAFA] transition-colors hover:bg-[#FAFAFA] hover:text-[#171717]"
        type="button"
        onClick={onClick}
      >
        {action}
      </button>
    </article>
  );
}

type CameraStartTarget =
  | { facingMode: { exact: 'environment' } }
  | { facingMode: 'environment' }
  | undefined;

async function startWithCameraFallback(
  scanner: Html5Qrcode,
  onScanSuccess: (decodedText: string) => void,
) {
  const targets: CameraStartTarget[] = [
    { facingMode: { exact: 'environment' } },
    { facingMode: 'environment' },
    undefined,
  ];
  let lastError: unknown;

  for (const target of targets) {
    try {
      if (target) {
        await scanner.start(target, scannerConfig, onScanSuccess, () => undefined);
        return;
      }

      const cameras = await Html5Qrcode.getCameras();

      if (cameras.length === 0) {
        throw new Error('No cameras found');
      }

      await scanner.start(
        cameras[0].id,
        scannerConfig,
        onScanSuccess,
        () => undefined,
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
