// FR-A-01/03: preview-only head display fix. Does not promote head tracking to body coverage.
export function patchHeadOnlyVisibility(source:string){
 const before="model.visible = state.status === 'tracking' || state.status === 'partial'"
 const anchor="if (!model.visible) return 'waiting' as const"
 if(source.split(before).length!==2||source.split(anchor).length!==2)throw new Error('Head-only preview binding mismatch')
 return source.replace(before,"const bodyVisible = state.status === 'tracking' || state.status === 'partial'\n      model.visible = bodyVisible || headTracking").replace(anchor,anchor+"\n      if (!bodyVisible && headTracking) return 'partial' as const")
}
