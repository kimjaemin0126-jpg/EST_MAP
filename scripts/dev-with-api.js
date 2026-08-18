const { spawn } = require('node:child_process')
const process = require('node:process')

const isWindows = process.platform === 'win32'

function spawnCommand(command, args = []) {
  if (isWindows) {
    const quotedArgs = args.map((arg) => {
      const value = String(arg)
      return /[\s"&|<>^]/.test(value)
        ? `"${value.replace(/"/g, '\\"')}"`
        : value
    })

    return spawn(
      'cmd.exe',
      ['/d', '/s', '/c', [command, ...quotedArgs].join(' ')],
      {
        stdio: 'inherit',
        windowsHide: false,
      },
    )
  }

  return spawn(command, args, {
    stdio: 'inherit',
  })
}

const api = spawnCommand(isWindows ? 'py' : 'python3', [
  'app.py',
  '--port',
  '8765',
])

api.on('error', (error) => {
  console.error('[api] 실행 실패:', error)
})

api.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`[api] 서버가 종료되었습니다. (exit ${code})`)
  }
})

const vite = spawnCommand('npx', ['vite'])

vite.on('error', (error) => {
  console.error('[vite] 실행 실패:', error)
})

let shuttingDown = false

function cleanup(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  if (!api.killed) api.kill()
  if (!vite.killed) vite.kill()

  setTimeout(() => process.exit(exitCode), 100)
}

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))

vite.on('exit', (code) => {
  cleanup(code ?? 0)
})
