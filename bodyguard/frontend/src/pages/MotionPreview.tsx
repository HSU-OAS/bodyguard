// FR-S-06·NFR-08: owned visual preview port; absent assets never become invented poses.
import { useEffect, useRef, useState } from 'react'

export type MotionMedia = Readonly<{ poster: string; video: string }>
export function MotionPreview({ title, media }: { title: string; media?: MotionMedia }) {
  const video = useRef<HTMLVideoElement>(null)
  const epoch = useRef(0)
  const wantsPlay = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const local = (path: string) => {
    try {
      const url = new URL(path, location.href)
      return (
        path.startsWith('/') &&
        !path.startsWith('//') &&
        !path.includes('\\') &&
        [...path].every((char) => char.charCodeAt(0) > 32 && char.charCodeAt(0) !== 127) &&
        url.origin === location.origin &&
        !url.username &&
        !url.password
      )
    } catch {
      return false
    }
  }
  const available = media && local(media.poster) && local(media.video)
  function stop() {
    wantsPlay.current = false
    epoch.current++
    video.current?.pause()
    setPlaying(false)
  }
  async function play(explicit = false) {
    if (
      !available ||
      failed ||
      document.hidden ||
      (!explicit && matchMedia('(prefers-reduced-motion: reduce)').matches)
    )
      return
    const owned = video.current,
      generation = ++epoch.current
    if (!owned) return
    wantsPlay.current = true
    try {
      await owned.play()
      if (generation !== epoch.current || document.hidden) {
        if (owned !== video.current || !wantsPlay.current || document.hidden) owned.pause()
        return
      }
      setPlaying(true)
    } catch {
      if (generation === epoch.current) {
        // Retire the current intent too: an earlier play promise may still resolve.
        stop()
        setFailed(true)
      }
    }
  }
  useEffect(() => {
    setFailed(false)
    setPlaying(false)
    if (!available || !media?.video) return
    const owned = video.current
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const pause = () => {
      wantsPlay.current = false
      epoch.current++
      owned?.pause()
      setPlaying(false)
    }
    const hidden = () => {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', hidden)
    reduced.addEventListener('change', pause)
    return () => {
      epoch.current++
      wantsPlay.current = false
      owned?.pause()
      document.removeEventListener('visibilitychange', hidden)
      reduced.removeEventListener('change', pause)
    }
  }, [available, media?.video])
  return (
    <fieldset
      className="motion-visual"
      aria-label={`${title} 미리보기`}
      onPointerEnter={() => {
        void play()
      }}
      onPointerLeave={stop}
      onFocusCapture={() => {
        void play()
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) stop()
      }}
    >
      {available ? (
        <>
          <video
            ref={video}
            src={media.video}
            poster={media.poster}
            muted
            playsInline
            preload="none"
            aria-label={`${title} 동작 영상`}
            onEnded={stop}
            onError={() => {
              stop()
              setFailed(true)
            }}
          />
          <div className="motion-visual-actions">
            <button
              type="button"
              className="button secondary"
              aria-label={`${title} 미리보기 ${playing ? '정지' : '재생'}`}
              aria-pressed={playing}
              onClick={() => {
                if (playing) stop()
                else void play(true)
              }}
            >
              {playing ? '정지' : '재생'}
            </button>
            {failed && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  stop()
                  setFailed(false)
                  video.current?.load()
                }}
              >
                다시 불러오기
              </button>
            )}
          </div>
          {failed && <p role="status">미리보기를 불러오지 못했습니다</p>}
        </>
      ) : (
        <div className="motion-visual-pending">
          <svg
            viewBox="0 0 32 32"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <rect x="5" y="5" width="22" height="22" rx="6" />
            <path d="m13 11 8 5-8 5Z" />
          </svg>
          <span>미리보기 준비 중</span>
        </div>
      )}
    </fieldset>
  )
}
