// Which camera to open. Laptops often expose several (built-in, phone via Continuity Camera,
// capture cards); `facingMode: 'user'` alone lets the browser pick any of them.
// The choice lives in memory only: no browser storage, nothing leaves the page.
import { CAMERA_CONSTRAINTS } from './constants'

export type CameraSource = Readonly<{ deviceId: string; label: string }>

let preferred: string | null = null
const listeners = new Set<() => void>()

export function preferredCamera() {
  return preferred
}

/** `null` returns to the browser default. Takes effect the next time a camera opens. */
export function setPreferredCamera(deviceId: string | null) {
  const next = typeof deviceId === 'string' && deviceId !== '' ? deviceId : null
  if (next === preferred) return
  preferred = next
  for (const listener of [...listeners]) listener()
}

export function subscribePreferredCamera(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Constraints for the chosen camera; the shared default object when none is chosen. */
export function cameraConstraints(deviceId: string | null = preferred): MediaStreamConstraints {
  if (deviceId === null) return CAMERA_CONSTRAINTS
  const { facingMode: _, ...video } = CAMERA_CONSTRAINTS.video as MediaTrackConstraints
  return { ...CAMERA_CONSTRAINTS, video: { ...video, deviceId: { exact: deviceId } } }
}

/** Video inputs. Before camera permission was granted once on this page, browsers hide ids and
 * names; `locked` says so, and the list may be empty. */
export async function listCameras(): Promise<{ cameras: CameraSource[]; locked: boolean }> {
  const enumerate = navigator.mediaDevices?.enumerateDevices
  if (typeof enumerate !== 'function') return { cameras: [], locked: false }
  const inputs = (await enumerate.call(navigator.mediaDevices)).filter(
    (device) => device.kind === 'videoinput',
  )
  return {
    cameras: inputs
      .filter((device) => device.deviceId !== '')
      .map((device) => Object.freeze({ deviceId: device.deviceId, label: device.label })),
    locked: inputs.some((device) => device.deviceId === '' || device.label === ''),
  }
}
