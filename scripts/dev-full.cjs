const { spawn } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const pythonCommand = process.platform === 'win32' ? 'python.exe' : 'python3'
const api = spawn(pythonCommand, ['app.py', '--port', '8765'], {
  cwd: root,
  stdio: 'inherit',
})
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, EST_MAP_API_PROXY: 'http://127.0.0.1:8765' },
  stdio: 'inherit',
})

let stopping = false
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  if (!api.killed) api.kill()
  if (!vite.killed) vite.kill()
  process.exitCode = exitCode
}

api.on('error', (error) => {
  console.error(`로컬 Python API를 시작하지 못했습니다: ${error.message}`)
  stop(1)
})
vite.on('error', (error) => {
  console.error(`Vite를 시작하지 못했습니다: ${error.message}`)
  stop(1)
})
api.on('exit', (code) => {
  if (!stopping) {
    console.error(`로컬 Python API가 종료되었습니다. (code ${code ?? 'unknown'})`)
    stop(code || 1)
  }
})
vite.on('exit', (code) => stop(code || 0))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
