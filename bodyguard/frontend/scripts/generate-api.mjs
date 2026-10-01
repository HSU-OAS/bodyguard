// FR-U-02/03/04, ADR-0015: types from the actual FastAPI schema; no server/DB/mail needed.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@hey-api/openapi-ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schema = execFileSync(
  'uv',
  [
    'run',
    '--locked',
    'python',
    '-c',
    [
      'import json',
      'from app.main import create_app',
      'from app.config import Settings',
      'print(json.dumps(create_app(Settings.from_environment()).openapi()))',
    ].join(';'),
  ],
  {
    cwd: join(root, '../backend'),
    encoding: 'utf8',
    env: {
      ...process.env,
      BODYGUARD_ENVIRONMENT: 'development',
      BODYGUARD_ORIGIN: 'http://localhost:5173',
      BODYGUARD_DATABASE_URL: 'postgresql+psycopg://bodyguard_test@localhost/bodyguard_test',
      BODYGUARD_SECURITY_KEY: randomBytes(32).toString('hex'),
      BODYGUARD_SMTP_USERNAME: '',
      BODYGUARD_SMTP_PASSWORD: '',
      BODYGUARD_GOOGLE_CLIENT_ID: '',
      BODYGUARD_GOOGLE_CLIENT_SECRET: '',
    },
  },
)
await createClient({
  input: JSON.parse(schema),
  output: { path: join(root, 'src/api/generated'), postProcess: ['biome:format'] },
  plugins: [{ name: '@hey-api/typescript', comments: false }],
})
