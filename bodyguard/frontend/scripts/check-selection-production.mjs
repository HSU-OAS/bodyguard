// FR-S-01/06, FR-V-03: actual production output must not contain unvalidated candidate UI.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const files = readdirSync(root, { recursive: true }).filter((name) => String(name).endsWith('.js'))
assert(files.length > 0, 'Build the production app first')
for (const file of files) {
  const text = readFileSync(join(root, String(file)), 'utf8')
  for (const forbidden of [
    'neck-side',
    'chin-retraction',
    'cross-body-shoulder',
    'lateral-trunk',
    'seated-trunk-rotation',
    '안내만 후보 · 자동 판정 없음',
    '목 옆으로 기울이기',
    'MotionSelectionPage',
    '동작 선택 개발 검수',
    'pending-validation',
    '/dev/select',
    'synthetic-algebra-only',
    'fixture-not-release',
    'An explicit validated coaching plan is required',
    'Step duration and repetition count must be explicitly valid',
    'ownership-error',
    'cleanup-error',
    'PRIVATE_FRAME_coordinates_account_METADATA',
    'clock-error',
    'gate-error',
    'callback-error',
    'PRIVATE_COORDINATES_ACCOUNT_FAILURE',
    'Invalid observation scheduler',
    'PRIVATE_OBSERVATION_LOOP_COORDINATES',
    'probeObservationLoop',
    'Invalid coaching result',
    'Unable to save coaching record',
    'PRIVATE_RESULT_COORDINATES_ACCOUNT',
    'prepareResultProbe',
    'Unable to capture coaching account',
    'PRIVATE_OWNER_COORDINATES_ACCOUNT',
    'prepareOwnerProbe',
    'Invalid recorded coaching session',
    'PRIVATE_RECORDED_CLOCK_COORDINATES',
    'prepareRecordedProbe',
    'mountAuthCoachingProbe',
    'preparation-error',
    'Invalid minute aggregation',
    'PRIVATE_SUMMARY_COORDINATES_ACCOUNT',
    'Invalid owned minute upload',
    'prepareMinuteUploadProbe',
    'PRIVATE_RAW_FAILURE',
    'Invalid alert delivery settings',
    'mountAlertDeliveryProbe',
    '__private-alert-delivery-probe',
    'Notification permission requires explicit user activation',
    'mountOwnedAlertProbe',
    '__private-owned-alert-probe',
    'useOwnedAlertDelivery',
  ]) {
    assert(!text.includes(forbidden), `Development candidate leaked into ${String(file)}`)
  }
}
console.log(
  JSON.stringify({
    production_JS_files_checked: files.length,
    development_catalog_strings: 0,
    unconnected_coaching_engine_strings: 0,
    unconnected_coaching_resource_strings: 0,
    unconnected_coaching_session_strings: 0,
    unconnected_observation_loop_strings: 0,
    unconnected_result_record_producer_strings: 0,
    unconnected_record_owner_capture_strings: 0,
    unconnected_recorded_session_strings: 0,
    unconnected_auth_coaching_hook_strings: 0,
    unconnected_minute_aggregation_strings: 0,
    unconnected_owned_minute_upload_strings: 0,
    unconnected_alert_delivery_strings: 0,
    unconnected_owned_alert_lifecycle_strings: 0,
  }),
)
