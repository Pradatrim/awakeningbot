/* ============================================================
   Bluetooth blood-pressure cuff integration (Web Bluetooth).

   Reads from any cuff that implements the standard Bluetooth SIG
   Blood Pressure Service (0x1810) — the same GATT profile used by
   Omron, A&D and most Medicare-grade RPM cuffs.

   Web Bluetooth needs a secure context (https / localhost) and a
   user gesture. Where it is unavailable, the simulated reading
   keeps the check-in flow working.
   ============================================================ */

export interface BpReading {
  sys: number;
  dia: number;
  heartRate?: number;
  /** bluetooth-cuff | simulated */
  source: 'bluetooth-cuff' | 'simulated';
}

const BLOOD_PRESSURE_SERVICE = 0x1810;
const BP_MEASUREMENT_CHAR = 0x2a35;

/** True when this browser/context can talk to Bluetooth devices. */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** IEEE-11073 16-bit SFLOAT — the encoding GATT vitals use. */
function parseSFloat(view: DataView, offset: number): number {
  const raw = view.getUint16(offset, true);
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x0008) exponent -= 0x0010;
  return mantissa * Math.pow(10, exponent);
}

/** Decodes a 0x2A35 Blood Pressure Measurement value. */
function parseBpMeasurement(view: DataView): BpReading {
  const flags = view.getUint8(0);
  const timestampPresent = (flags & 0x02) !== 0;
  const pulsePresent = (flags & 0x04) !== 0;

  const sys = Math.round(parseSFloat(view, 1));
  const dia = Math.round(parseSFloat(view, 3));
  // offset 5..6 is Mean Arterial Pressure — skipped.

  let cursor = 7;
  if (timestampPresent) cursor += 7; // year(2) month day hour min sec

  let heartRate: number | undefined;
  if (pulsePresent && view.byteLength >= cursor + 2) {
    heartRate = Math.round(parseSFloat(view, cursor));
  }

  return { sys, dia, heartRate, source: 'bluetooth-cuff' };
}

/**
 * Prompts the patient to pick their cuff, connects, and waits for
 * one measurement. Must be called from a user gesture.
 */
export async function readFromCuff(): Promise<BpReading> {
  if (!isBluetoothSupported()) {
    throw new Error('This device cannot connect to Bluetooth.');
  }
  const bt = (navigator as any).bluetooth;

  const device = await bt.requestDevice({
    filters: [{ services: [BLOOD_PRESSURE_SERVICE] }],
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLOOD_PRESSURE_SERVICE);
  const characteristic = await service.getCharacteristic(BP_MEASUREMENT_CHAR);

  return new Promise<BpReading>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('No reading received from the cuff.'));
    }, 60000);

    function onValue(event: Event) {
      const value = (event.target as any).value as DataView;
      cleanup();
      try {
        resolve(parseBpMeasurement(value));
      } catch (e) {
        reject(e as Error);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      characteristic.removeEventListener('characteristicvaluechanged', onValue);
      try {
        device.gatt.disconnect();
      } catch {
        /* already disconnected */
      }
    }

    characteristic.addEventListener('characteristicvaluechanged', onValue);
    characteristic.startNotifications().catch((e: Error) => {
      cleanup();
      reject(e);
    });
  });
}

/** A plausible reading for when no physical cuff is connected. */
export function simulateReading(): Promise<BpReading> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          sys: 118 + Math.floor(Math.random() * 21),
          dia: 72 + Math.floor(Math.random() * 15),
          heartRate: 62 + Math.floor(Math.random() * 17),
          source: 'simulated',
        }),
      2400,
    ),
  );
}
