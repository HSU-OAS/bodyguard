// FR-M-02/07: captured input geometry, independent of DOM/display mirroring.
export type CapturedImage = Readonly<{
  width: number
  height: number
  imageIsMirrored: boolean
}>

export function copyCapturedImage(image: CapturedImage | undefined): CapturedImage | undefined {
  if (image === undefined) return undefined
  const { width, height, imageIsMirrored } = image
  if (
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    !Number.isSafeInteger(height) ||
    height <= 0 ||
    typeof imageIsMirrored !== 'boolean'
  )
    throw new Error('Invalid captured image')
  return Object.freeze({ width, height, imageIsMirrored })
}
