// FR-M-01/02/07/NFR-07/08: native fake-camera/SDK only; no pixels, landmarks or matrices escape.

import { createBodyFaceVideoSource } from '../../src/pose/bodyFaceVideoSource'
import { closeCamera, openCamera } from '../../src/pose/camera'
import { createFaceLandmarker } from '../../src/pose/face'
import { createPoseLandmarker } from '../../src/pose/landmarker'

export async function mountBodyFaceProbe() {
  const video = document.createElement('video')
  video.hidden = true
  video.muted = true
  video.playsInline = true
  const abort = new AbortController()
  let stream: MediaStream | undefined,
    pose: Awaited<ReturnType<typeof createPoseLandmarker>> | undefined,
    face: Awaited<ReturnType<typeof createFaceLandmarker>> | undefined,
    source: ReturnType<typeof createBodyFaceVideoSource> | undefined
  let closed = false,
    generation = 1,
    bodyCalls = 0,
    faceCalls = 0,
    bodyCloses = 0,
    poseCloses = 0,
    faceCloses = 0,
    coherent = 0,
    openInputs = 0,
    allInputsClosed = 0,
    delivered = 0,
    lastAt = -Infinity,
    lastSequence = 0,
    increasing = true,
    nullHeads = 0,
    emptyBodies = 0,
    emptyFaces = 0,
    plainFaceResults = true,
    headOnlyFields = true
  let bodyInput: VideoFrame | undefined,
    bodyAt = -Infinity,
    facePending = false,
    hold = false,
    releaseHeld: (() => void) | undefined
  function inputOpen(frame: VideoFrame) {
    const copy = frame.clone()
    copy.close()
    openInputs++
  }
  function prepare() {
    if (!stream || !pose || !face || closed)
      throw new Error('Private body face fixture unavailable')
    source = createBodyFaceVideoSource(
      { generation, signal: abort.signal },
      {
        video,
        stream,
        matrixLayout: 'column-major',
        detectBody(frame, at) {
          if (!pose) throw new Error('Private body face fixture unavailable')
          inputOpen(frame)
          bodyInput = frame
          bodyAt = at
          bodyCalls++
          const result = pose.landmarker.detectForVideo(frame, at)
          return {
            landmarks: result.landmarks,
            worldLandmarks: result.worldLandmarks,
            close() {
              bodyCloses++
              result.close()
            },
          }
        },
        async detectFace(frame, at) {
          if (!face) throw new Error('Private body face fixture unavailable')
          inputOpen(frame)
          faceCalls++
          if (frame === bodyInput && at === bodyAt) coherent++
        const result = face.landmarker.detectForVideo(frame, at)
        if (result.faceLandmarks.length === 0) emptyFaces++
        plainFaceResults &&= !('close' in result)
          if (hold) {
            hold = false
            facePending = true
            await new Promise<void>((resolve) => {
              releaseHeld = resolve
            })
            facePending = false
            releaseHeld = undefined
          }
          return result
        },
      },
    )
  }
  function snapshot() {
    let heldInputOpen = false
    if (bodyInput) {
      try { const copy = bodyInput.clone(); copy.close(); heldInputOpen = true }
      catch { /* Only the fixed open/closed predicate escapes. */ }
    }
    return {
      closed,
      generation,
      bodyCalls,
      faceCalls,
      bodyCloses,
      poseCloses,
      faceCloses,
      coherent,
      openInputs,
      allInputsClosed,
      delivered,
      increasing,
      nullHeads,
      emptyBodies,
      emptyFaces,
      plainFaceResults,
      heldInputOpen,
      headOnlyFields,
      facePending,
      cameraLive: stream?.getVideoTracks().every((t) => t.readyState === 'live') ?? false,
      tracksEnded: stream?.getTracks().every((t) => t.readyState === 'ended') ?? false,
      videoDetached: video.srcObject === null,
      inputHidden: video.hidden,
      actualHuman: false,
      fakeCamera: true,
      poseDelegate: pose?.delegate,
      faceDelegate: face?.delegate,
    }
  }
  async function read() {
    const observed = await source?.read()
    if (bodyInput) {
      try {
        const copy = bodyInput.clone()
        copy.close()
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') allInputsClosed++
      }
    }
    if (observed) {
      delivered++
      increasing &&=
        observed.generation === generation &&
        observed.at === bodyAt &&
        observed.at > lastAt &&
        observed.sequence > lastSequence
      lastAt = observed.at
      lastSequence = observed.sequence
      if (observed.result.headOrientation === null) nullHeads++
      if (!observed.result.landmarks.length && !observed.result.worldLandmarks.length) emptyBodies++
      headOnlyFields &&=
        Object.keys(observed.result).sort().join(',') === 'headOrientation,landmarks,worldLandmarks'
    }
    return { accepted: !!observed, ...snapshot() }
  }
  async function retire() {
    await source?.dispose()
    return snapshot()
  }
  async function close() {
    if (!closed) {
      closed = true
      releaseHeld?.()
      try {
        await source?.dispose()
      } finally {
        abort.abort()
        try {
          if (pose) {
            pose.landmarker.close()
            poseCloses++
          }
        } finally {
          try {
            if (face) {
              face.landmarker.close()
              faceCloses++
            }
          } finally {
            if (stream) closeCamera(video, stream)
            video.remove()
          }
        }
      }
    }
    return snapshot()
  }
  try {
    stream = await openCamera(video, abort.signal)
    pose = await createPoseLandmarker('lite')
    face = await createFaceLandmarker()
    prepare()
    return Object.freeze({
      snapshot,
      read,
      retire,
      close,
      holdNext: () => {
        hold = true
      },
      release: () => {
        releaseHeld?.()
      },
      async resume() {
        await retire()
        generation++
        prepare()
        return snapshot()
      },
    })
  } catch {
    await close()
    throw new Error('Private body face fixture unavailable')
  }
}
