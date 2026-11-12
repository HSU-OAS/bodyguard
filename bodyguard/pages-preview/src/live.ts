// FR-M-01/02/07 · FR-A-01/03: loopback-only tracking inspection; no classifier, auth or writes.
import { prepareReferenceStage } from '../../frontend/src/avatar/referenceStage'
import { createOwnedPlaybackResources } from '../../frontend/src/coaching/ownedPlaybackResources'
import { createResourceController } from '../../frontend/src/coaching/resources'
import { openCamera, closeCamera, cameraErrorKind } from '../../frontend/src/pose/camera'
import { createWorkerPoseInference } from '../../frontend/src/pose/workerInference'
import { createVideoPoseSource } from '../../frontend/src/pose/videoPoseSource'
import type { AvatarGender } from '../../frontend/src/avatar/reviewAvatarAssets'
import type { ReferenceView } from '../../frontend/src/avatar/referenceStage'

document.querySelector('#root')!.innerHTML = '<header><strong>BODYGUARD · 실제 웹캠 추종 검수</strong><span>자세 판정·기록 저장 꺼짐 · 아바타는 검수 후보</span></header><main><div class="toolbar"><label>아바타 <select id="gender"><option value="male">남성</option><option value="female">여성</option></select></label><label>보기 <select id="view"><option value="full">전신</option><option value="upper">상반신</option><option value="detail">자세히</option></select></label><label><input id="detailed-hands" type="checkbox"> 손가락까지 추적</label><button id="start">웹캠 시작</button><button id="align" disabled>정면 맞추기</button><button id="stop" disabled>웹캠 종료</button><span id="counter"></span></div><p id="status" role="status">시작을 누르고 브라우저의 카메라 권한을 허용하세요.</p><section class="space"><div class="roles"><strong>내 움직임 · 웹캠 입력</strong><strong>기준 아바타 · 중립 자세</strong></div><canvas id="avatar" aria-label="실제 웹캠 입력 두 아바타 검수"></canvas></section><aside class="camera-box"><video id="camera" muted playsinline aria-label="내 카메라 미리보기"></video><span>내 카메라 · 브라우저 내부 처리</span></aside><p class="help">화면에서 한 걸음 물러나 어깨와 팔이 보이게 한 뒤, 한 팔을 천천히 들어보세요. 머리 방향은 정면을 본 상태에서 ‘정면 맞추기’를 누르세요.</p><p class="note">lite 모델 추종 검수입니다. 실제 정확도·노트북 성능은 검증 중이며, 촬영 범위 밖의 움직임까지 재현하지는 않습니다. 영상·좌표를 저장·전송하지 않습니다.</p></main>'
const start=document.querySelector<HTMLButtonElement>('#start')!, stop=document.querySelector<HTMLButtonElement>('#stop')!, align=document.querySelector<HTMLButtonElement>('#align')!, gender=document.querySelector<HTMLSelectElement>('#gender')!, view=document.querySelector<HTMLSelectElement>('#view')!, handsOption=document.querySelector<HTMLInputElement>('#detailed-hands')!, status=document.querySelector<HTMLParagraphElement>('#status')!, counter=document.querySelector('#counter')!, video=document.querySelector<HTMLVideoElement>('#camera')!
const statusText=(message:string)=>{status.textContent=message}
const failures:{reason:string;phase:string;atMs:number}[]=[]
let nextGeneration=0, active:ReturnType<typeof createOwnedPlaybackResources>|undefined, controller:ReturnType<typeof createResourceController>|undefined, phase='idle', generation=0, frames=0, tracked=0, lastPublish=0, error:string|null=null, busyClose:Promise<void>|undefined, poisoned=false
let bodySignal:'none'|'single'|'multiple'='none',headSignal=false,headTracked=false
const setControls=()=>{start.disabled=phase!=='idle'||poisoned;stop.disabled=phase==='idle'||phase==='closing';gender.disabled=phase!=='idle';handsOption.disabled=phase!=='idle';align.disabled=phase!=='running'}
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
  tracked=0;bodySignal='none';headSignal=headTracked=false
  statusText(failed?'카메라 종료를 요청했으나 추론 자원 해제를 확인하지 못했습니다. 새로고침 후 다시 시작하세요.':message)
 })()
 busyClose=closing
 try{await closing}finally{if(busyClose===closing)busyClose=undefined}
}
start.addEventListener('click',async()=>{
 if(phase!=='idle'||poisoned||busyClose)return
 phase='preparing';error=null;frames=tracked=0;generation=++nextGeneration;setControls();statusText('카메라 권한을 요청합니다.')
 const canvas=document.querySelector<HTMLCanvasElement>('#avatar')!, picked=gender.value as AvatarGender, pickedHands=handsOption.checked
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
   const stage=await prepareReferenceStage(context,{canvas,gender:picked,motion:'arm-overhead',onFailure:()=>fail('asset-error')})
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
      if(needsAlignment&&bodySignal==='single'&&headSignal){
       stage.alignObservation()
       needsAlignment=false
      }
     }
     return accepted
    },
    render(now:number,delta:number){
     const state=stage.render(now,delta,{phase:'waiting-start',stepId:'left',playing:false,revision:1,view:view.value as ReferenceView})??{status:'untracked' as const,tracked:0,total:9}
     tracked=state.tracked
     headTracked=stage.getObservationCoverage()?.headTracking===true
     if(now-lastPublish>250){lastPublish=now;counter.textContent='입력 '+frames+' 프레임';if(phase==='running')statusText(state.tracked>0?'웹캠 추종 중 · 팔과 몸통을 천천히 움직여보세요.':headTracked?'머리 방향 추종 중 · 팔도 움직이려면 양쪽 팔꿈치·손목까지 화면에 넣어주세요.':bodySignal==='multiple'?'화면에 한 사람만 나오도록 조정해 주세요.':bodySignal==='none'?'카메라는 연결됐지만 신체를 찾지 못했습니다. 조금 물러나 양쪽 팔꿈치까지 보이게 해주세요.':'신체는 감지됐지만 팔·몸통 방향을 확인하지 못했습니다. 양쪽 팔꿈치·손목까지 보이게 해주세요.')}
     return state
    },
    align(){needsAlignment=false;return stage.alignObservation()},
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
align.addEventListener('click',()=>{if(active?.command(generation,pair=>'align'in pair&&typeof pair.align==='function'&&pair.align()===true))statusText('현재 정면을 기준으로 머리 방향을 맞춥니다.')})
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&phase!=='idle')void shutdown('화면을 벗어나 웹캠을 종료했습니다. 다시 시작할 수 있습니다.')})
window.addEventListener('pagehide',()=>{void shutdown()})
// Only scalar resource/transport diagnostics, never images, coordinates or account data.
Object.assign(window,{bodyguardLivePreview:{snapshot:()=>({phase,frames,tracked,bodySignal,headSignal,headTracked,error,generation,failures:[...failures],resources:active?.getSnapshot()??null,cameraLive:video.srcObject instanceof MediaStream&&video.srcObject.getVideoTracks().some(t=>t.readyState==='live'),model:'lite',detailedHands:handsOption.checked,classifier:false,recording:false})}})
setControls()
