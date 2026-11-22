// FR-M-01/02/07 · FR-A-01/03: loopback-only tracking inspection; no classifier, auth or writes.
import { prepareReferenceStage } from '../../frontend/src/avatar/referenceStage'
import { createOwnedPlaybackResources } from '../../frontend/src/coaching/ownedPlaybackResources'
import { createResourceController } from '../../frontend/src/coaching/resources'
import { openCamera, closeCamera, cameraErrorKind } from '../../frontend/src/pose/camera'
import { createWorkerPoseInference } from '../../frontend/src/pose/workerInference'
import { createVideoPoseSource } from '../../frontend/src/pose/videoPoseSource'
import { createNeckDirectionReview } from '../../frontend/src/posture/neckDirectionReview'
import type { AvatarGender } from '../../frontend/src/avatar/reviewAvatarAssets'
import type { ReferenceCommand, ReferenceView } from '../../frontend/src/avatar/referenceStage'

declare const __BODYGUARD_LOCAL_NECK_REVIEW__: boolean
document.querySelector('#root')!.innerHTML = '<header><a class="wordmark" href="/bodyguard/">BODYGUARD</a><span>자세 판정·기록 저장 꺼짐 · 아바타는 검수 후보</span></header><main><h1 class="inspection-title">웹캠 추종 체험</h1><div class="toolbar"><label>아바타 <select id="gender"><option value="male">남성</option><option value="female">여성</option></select></label><label>보기 <select id="view"><option value="full">전신</option><option value="upper">상반신</option><option value="detail">자세히</option></select></label><label><input id="detailed-hands" type="checkbox"> 손가락까지 추적</label><button id="start">웹캠 시작</button><button id="align" disabled>정면 맞추기</button><button id="stop" disabled>웹캠 종료</button><span id="counter"></span></div><p id="status" role="status">시작을 누르고 브라우저의 카메라 권한을 허용하세요.</p><section class="space"><div class="roles"><strong>내 움직임 · 웹캠 입력</strong><strong>기준 아바타 · 중립 자세</strong></div><canvas id="avatar" aria-label="실제 웹캠 입력 두 아바타 검수"></canvas></section><aside class="camera-box"><video id="camera" muted playsinline aria-label="내 카메라 미리보기"></video><span>내 카메라 · 브라우저 내부 처리</span></aside><p class="help">화면에서 한 걸음 물러나 어깨와 팔이 보이게 한 뒤, 한 팔을 천천히 들어보세요. 머리 방향은 정면을 본 상태에서 ‘정면 맞추기’를 누르세요.</p><p class="note">lite 모델 추종 검수입니다. 실제 정확도·노트북 성능은 검증 중이며, 촬영 범위 밖의 움직임까지 재현하지는 않습니다. 영상·좌표를 저장·전송하지 않습니다.</p></main>'
const start=document.querySelector<HTMLButtonElement>('#start')!, stop=document.querySelector<HTMLButtonElement>('#stop')!, align=document.querySelector<HTMLButtonElement>('#align')!, gender=document.querySelector<HTMLSelectElement>('#gender')!, view=document.querySelector<HTMLSelectElement>('#view')!, handsOption=document.querySelector<HTMLInputElement>('#detailed-hands')!, status=document.querySelector<HTMLParagraphElement>('#status')!, counter=document.querySelector('#counter')!, video=document.querySelector<HTMLVideoElement>('#camera')!
const alignHands=document.createElement('button'), handStatus=document.createElement('span')
alignHands.type='button'
alignHands.textContent='손 맞추기'
handStatus.setAttribute('role','status')
align.after(alignHands,handStatus)
// FR-S-06: allowlisted selection sets the inspection context and camera framing only.
const inspectionSelections:Record<string,readonly [string,ReferenceView]>={
 'neck-side':['목 옆 늘리기','upper'],
 'chin-retraction':['턱 당기기','upper'],
 'shoulder-shrug':['어깨 올리기','upper'],
 'cross-body-shoulder':['양팔 교차하기','upper'],
 'arm-overhead':['팔 위로 늘리기','full'],
 'lateral-trunk':['옆구리 늘리기','full'],
 'seated-trunk-rotation':['몸통 돌리기','full'],
}
const selectionId=new URLSearchParams(location.search).get('motion')??''
const selection=Object.hasOwn(inspectionSelections,selectionId)?inspectionSelections[selectionId]:undefined
if(selection){
 document.querySelector('.inspection-title')!.textContent=selection[0]+' · 웹캠 추종 체험'
 view.value=selection[1]
}
// The neck direction check is restricted to explicitly built loopback inspection.
const shoulderReference=selectionId==='shoulder-shrug'
const neckReview=__BODYGUARD_LOCAL_NECK_REVIEW__&&selectionId==='neck-side'&&
 ['localhost','127.0.0.1','[::1]'].includes(location.hostname)
const referencePhases=['waiting-start','seeking-target','waiting-return'] as const
let referencePhase:ReferenceCommand['phase']|undefined
let referenceSide:'left'|'right'='left'
let referenceStep:HTMLSelectElement|undefined
let referenceReplay:HTMLButtonElement|undefined
let referenceRevision=1
let directionStatus:HTMLParagraphElement|undefined
if(shoulderReference||neckReview){
 document.querySelector('.roles strong:last-child')!.textContent=neckReview?'기준 아바타 · 목 방향 시범':'기준 아바타 · 어깨 올리기 시범'
 const steps=neckReview
  ?'<option value="waiting-start">준비</option><option value="left">왼쪽 시범</option><option value="right">오른쪽 시범</option>'
  :'<option value="waiting-start">준비</option><option value="seeking-target">올리기</option><option value="waiting-return">내리기</option>'
 document.querySelector('.toolbar')!.insertAdjacentHTML('beforeend','<label>시범 단계 <select id="reference-step" disabled>'+steps+'</select></label>')
 referenceStep=document.querySelector<HTMLSelectElement>('#reference-step')!
 referenceStep.addEventListener('change',()=>{
  const picked=referenceStep?.value
  if(neckReview&&(picked==='left'||picked==='right')){
   referenceSide=picked
   referencePhase='seeking-target'
  }else{
   referencePhase=referencePhases.find(candidate=>candidate===picked)
  }
  setControls()
 })
}
if(neckReview){
 document.querySelector('.inspection-title')!.textContent='목 옆 기울이기 · 방향 대조'
 document.querySelector('.help')!.textContent='정면을 기준으로 맞춘 뒤 시범 단계를 고르세요.'
 referenceReplay=document.createElement('button')
 referenceReplay.type='button'
 referenceReplay.textContent='시범 다시 보기'
 referenceReplay.addEventListener('click',()=>{
  if(phase==='running'&&referencePhase==='seeking-target') referenceRevision++
 })
 referenceStep?.closest('label')?.after(referenceReplay)
 view.value='detail'
 directionStatus=document.createElement('p')
 directionStatus.id='direction-status'
 directionStatus.setAttribute('role','status')
 directionStatus.textContent='정면을 보고 ‘정면 맞추기’를 누르세요.'
 status.after(directionStatus)
}
const statusText=(message:string)=>{status.textContent=message}
const failures:{reason:string;phase:string;atMs:number}[]=[]
let nextGeneration=0, active:ReturnType<typeof createOwnedPlaybackResources>|undefined, controller:ReturnType<typeof createResourceController>|undefined, phase='idle', generation=0, frames=0, tracked=0, lastPublish=0, error:string|null=null, busyClose:Promise<void>|undefined, poisoned=false
let bodySignal:'none'|'single'|'multiple'='none',headSignal=false,headTracked=false,handTracked=false,handsPending=false
const setControls=()=>{
 start.disabled=phase!=='idle'||poisoned
 stop.disabled=phase==='idle'||phase==='closing'
 gender.disabled=handsOption.disabled=phase!=='idle'
 align.disabled=alignHands.disabled=phase!=='running'
 alignHands.hidden=handStatus.hidden=!handsOption.checked
 if(referenceStep) referenceStep.disabled=phase!=='running'
 if(referenceReplay) referenceReplay.disabled=phase!=='running'||referencePhase!=='seeking-target'
}
async function shutdown(message='웹캠을 종료했습니다.'){
 if(busyClose)return busyClose
 const owner=active, control=controller
 phase='closing';setControls();statusText('카메라와 추론을 종료하는 중입니다.')
 const closing=(async()=>{
  let failed=false
  try{await control?.close()}catch{failed=true}
  try{await owner?.close()}catch{failed=true}
  if(active===owner){active=undefined;controller=undefined}
  if(failed){poisoned=true;error='cleanup-error'}
  phase='idle';setControls()
  counter.textContent=''
  tracked=0;bodySignal='none';headSignal=headTracked=handTracked=handsPending=false
  handStatus.textContent=''
  if(directionStatus){
   directionStatus.textContent='정면을 보고 ‘정면 맞추기’를 누르세요.'
   directionStatus.removeAttribute('data-opposite')
  }
  statusText(failed?'카메라 종료를 요청했으나 추론 자원 해제를 확인하지 못했습니다. 새로고침 후 다시 시작하세요.':message)
 })()
 busyClose=closing
 try{await closing}finally{if(busyClose===closing)busyClose=undefined}
}
start.addEventListener('click',async()=>{
 if(phase!=='idle'||poisoned||busyClose)return
 phase='preparing';error=null;frames=tracked=0;generation=++nextGeneration;setControls();statusText('카메라 권한을 요청합니다.')
 referencePhase=undefined
 if(referenceStep) referenceStep.value='waiting-start'
 const previousCanvas=document.querySelector<HTMLCanvasElement>('#avatar')!
 // Each session disposes its WebGL context. A retired canvas cannot start another session.
 const canvas=previousCanvas.cloneNode(false) as HTMLCanvasElement
 previousCanvas.replaceWith(canvas)
 const picked=gender.value as AvatarGender, pickedHands=handsOption.checked
 let owner:ReturnType<typeof createOwnedPlaybackResources>
 const fail=(reason:string)=>{
  if(failures.length<20)failures.push({reason,phase,atMs:Math.round(performance.now())})
  error=reason
  void shutdown(reason==='camera-error'?'카메라를 열 수 없습니다. 주소창 카메라 권한과 다른 앱의 카메라 사용 여부를 확인하세요.':reason==='inference-error'?'카메라 추론이 중단됐습니다. 새로고침 후 다시 시작하세요.':'아바타 또는 자원 준비에 실패했습니다. 새로고침 후 다시 시작하세요.')
 }
 owner=createOwnedPlaybackResources({
  async camera(context){
   try{
    const stream=await openCamera(video,context.signal)
    return {video,stream,dispose:()=>closeCamera(video,stream)}
   }catch(e){error='camera-'+cameraErrorKind(e);throw e}
  },
  async inference(context){
   statusText('카메라 연결됨 · 로컬 CPU 추론 모델을 준비합니다.')
   return createWorkerPoseInference(context,{model:'lite',face:true,hands:pickedHands,matrixLayout:'column-major'})
  },
  async avatars(context){
   statusText('추론 모델 준비됨 · 3D 아바타를 준비합니다.')
   const direction=neckReview?createNeckDirectionReview(context.generation):undefined
   const motion=neckReview?'neck-side':shoulderReference?'shoulder-shrug':'arm-overhead'
   const stage=await prepareReferenceStage(context,{canvas,gender:picked,motion,mirrorUserDisplay:true,mirrorGuideDisplay:neckReview,onFailure:()=>fail('asset-error')})
   if(!stage.beginObservation(context.generation)){stage.dispose();throw new Error('Observation unavailable')}
   // FR-A-01/03: align after fresh detail arrives, never before cold inference.
   let needsAlignment=true
   return {
    observe(frame:Parameters<typeof stage.observe>[0]){
     bodySignal=frame.result.landmarks.length===1?'single':frame.result.landmarks.length===0?'none':'multiple'
     headSignal=Array.isArray(frame.result.headOrientation)&&frame.result.headOrientation.length===4
     const accepted=stage.observe(frame)
     if(accepted){
      frames++
      direction?.observe(frame,performance.now())
      if(needsAlignment&&bodySignal==='single'&&headSignal){
       stage.alignObservation(pickedHands?'all':'head')
       needsAlignment=false
      }
     }
     return accepted
    },
    render(now:number,delta:number){
     const state=stage.render(now,delta,{
      phase:referencePhase??'waiting-start',stepId:shoulderReference?'both':referenceSide,
      playing:referencePhase!==undefined,revision:referenceRevision,view:view.value as ReferenceView,
     })??{status:'untracked' as const,tracked:0,total:9}
     tracked=state.tracked
     headTracked=stage.getObservationCoverage()?.headTracking===true
     const detail=stage.getDetailStatus()
     handsPending=detail?.handsPending===true
     handTracked=detail?.handTracking===true
     if(directionStatus&&direction){
      const observation=direction.read(now)
      const names={left:'왼쪽',right:'오른쪽',center:'기준 위치'} as const
      const comparing=observation.state==='observed'&&referencePhase==='seeking-target'
      const opposite=comparing&&observation.direction!=='center'&&observation.direction!==referenceSide
      let message='움직임 확인 중'
      if(observation.state==='waiting') message='정면을 보고 ‘정면 맞추기’를 누르세요.'
      if(observation.state==='unavailable') message='머리와 양쪽 어깨가 화면에 들어오게 조정해 주세요.'
      if(observation.state==='observed'){
       if(!comparing) message='카메라에서 보이는 움직임 '+names[observation.direction]
       else if(opposite) message='시범과 반대 방향입니다. 정면으로 돌아와 '+names[referenceSide]+' 시범을 다시 보세요.'
       else if(observation.direction===referenceSide) message='시범과 같은 방향입니다.'
       else message='정면을 기준으로 '+names[referenceSide]+' 시범을 확인하세요.'
      }
      if(directionStatus.textContent!==message) directionStatus.textContent=message
      if(opposite!==directionStatus.hasAttribute('data-opposite')) directionStatus.toggleAttribute('data-opposite',opposite)
     }
     if(pickedHands){
      const message=handsPending?'양손을 펴서 카메라에 보여주세요.':handTracked?'손가락 추종 중':'양손을 화면에 넣고 손 맞추기를 눌러주세요.'
      if(handStatus.textContent!==message) handStatus.textContent=message
     }
     if(now-lastPublish>250){lastPublish=now;counter.textContent='입력 '+frames+' 프레임';if(phase==='running')statusText(state.tracked>0?(neckReview?'웹캠 추종 중 · 머리와 양쪽 어깨를 화면에 넣어 주세요.':'웹캠 추종 중 · 팔과 몸통을 천천히 움직여보세요.'):headTracked?'머리 방향 추종 중 · 팔도 움직이려면 양쪽 팔꿈치·손목까지 화면에 넣어주세요.':bodySignal==='multiple'?'화면에 한 사람만 나오도록 조정해 주세요.':bodySignal==='none'?'카메라는 연결됐지만 신체를 찾지 못했습니다. 조금 물러나 양쪽 팔꿈치까지 보이게 해주세요.':'신체는 감지됐지만 팔·몸통 방향을 확인하지 못했습니다. 양쪽 팔꿈치·손목까지 보이게 해주세요.')}
     return state
    },
    align(target:'head'|'hands'){
     if(target==='head'){
      needsAlignment=false
      direction?.align(performance.now())
     }
     return stage.alignObservation(target)
    },
    dispose:stage.dispose,
   }
  },
  source:(context,camera,inference)=>createVideoPoseSource(context,{video:camera.video,stream:camera.stream,detect:inference.detect}),
  scheduler:{request:cb=>requestAnimationFrame(()=>cb(performance.now())),cancel:handle=>cancelAnimationFrame(handle)},
  render(){},
  onFailure:notice=>fail(notice.reason),
 })
 active=owner
 const ownController=createResourceController(owner.ports,notice=>{
  if(active!==owner||phase==='closing')return
  if(notice.type==='error'){fail(notice.reason);return}
  if(!owner.start(notice.generation)){fail('ownership-error');return}
  phase='running';setControls();statusText('웹캠 입력 수신 중 · 어깨와 팔이 화면에 보이도록 조정하세요.')
 })
 controller=ownController
 try{await ownController.run({type:'request-camera',generation})}catch{fail('ownership-error')}
})
stop.addEventListener('click',()=>{void shutdown()})
align.addEventListener('click',()=>{if(active?.command(generation,pair=>'align'in pair&&typeof pair.align==='function'&&pair.align('head')===true))statusText('현재 정면을 기준으로 머리 방향을 맞춥니다.')})
alignHands.addEventListener('click',()=>{active?.command(generation,pair=>'align'in pair&&typeof pair.align==='function'&&pair.align('hands')===true)})
handsOption.addEventListener('change',setControls)
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&phase!=='idle')void shutdown('화면을 벗어나 웹캠을 종료했습니다. 다시 시작할 수 있습니다.')})
window.addEventListener('pagehide',()=>{void shutdown()})
// Only scalar resource/transport diagnostics, never images, coordinates or account data.
Object.assign(window,{bodyguardLivePreview:{snapshot:()=>({phase,frames,tracked,bodySignal,headSignal,headTracked,handTracked,handsPending,error,generation,failures:[...failures],resources:active?.getSnapshot()??null,cameraLive:video.srcObject instanceof MediaStream&&video.srcObject.getVideoTracks().some(t=>t.readyState==='live'),model:'lite',detailedHands:handsOption.checked,classifier:false,recording:false})}})
setControls()
