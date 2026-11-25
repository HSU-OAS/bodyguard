import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  type CameraSource,
  listCameras,
  preferredCamera,
  setPreferredCamera,
  subscribePreferredCamera,
} from '../pose/cameraSource'

type Props = Readonly<{
  /** Called after the choice changed, so an open camera can be closed and reopened. */
  onChange?: (deviceId: string | null) => void
}>

/** Camera picker. Lists devices only; it never opens a camera itself. */
export function CameraSourceSelect({ onChange }: Props) {
  const chosen = useSyncExternalStore(subscribePreferredCamera, preferredCamera, preferredCamera)
  const [cameras, setCameras] = useState<readonly CameraSource[]>([])
  const [locked, setLocked] = useState(false)
  const show = useCallback((found: Awaited<ReturnType<typeof listCameras>> | null) => {
    setCameras(found?.cameras ?? [])
    setLocked(found?.locked ?? false)
  }, [])
  const refresh = useCallback(() => {
    listCameras().then(show, () => show(null))
  }, [show])
  useEffect(() => {
    let live = true
    const update = () => {
      listCameras().then(
        (found) => live && show(found),
        () => live && show(null),
      )
    }
    update()
    const devices = navigator.mediaDevices
    devices?.addEventListener?.('devicechange', update)
    return () => {
      live = false
      devices?.removeEventListener?.('devicechange', update)
    }
  }, [show])
  const known = chosen !== null && cameras.some((camera) => camera.deviceId === chosen)
  return (
    <>
      <label>
        카메라
        <select
          value={known ? chosen : ''}
          onFocus={refresh}
          onPointerDown={refresh}
          onChange={(event) => {
            const next = event.target.value === '' ? null : event.target.value
            setPreferredCamera(next)
            onChange?.(next)
          }}
        >
          <option value="">기본 카메라</option>
          {cameras.map((camera, index) => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {camera.label || `카메라 ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      {locked && <p className="small muted">카메라를 한 번 켜면 기기 이름이 표시됩니다.</p>}
    </>
  )
}
