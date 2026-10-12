import { connect } from 'node:net'

const socket = connect(process.env.BSTACK_EVAL_PREFLIGHT_SOCKET)
let output = ''
socket.setTimeout(5000)
socket.on('data', chunk => { output += chunk; if (output.length > 4096) socket.destroy(new Error('Invalid preflight response')) })
socket.on('timeout', () => socket.destroy(new Error('Preflight timeout')))
socket.on('error', () => { console.log(JSON.stringify({ source: 'host', permitted: false, error: 'Host resource preflight unavailable.' })); process.exitCode = 2 })
socket.on('end', () => {
  try {
    const result = JSON.parse(output)
    console.log(JSON.stringify(result))
    process.exitCode = result.source === 'host' && result.permitted === true ? 0 : 2
  } catch { console.log(JSON.stringify({ source: 'host', permitted: false, error: 'Invalid host resource preflight response.' })); process.exitCode = 2 }
})
