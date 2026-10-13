
// Starts the API server and the Vite dev server together. Ctrl+C stops both.
import { spawn } from 'node:child_process';
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: true });
const procs = [run('node', ['server/index.js']), run('npx', ['vite'])];
const stop = () => procs.forEach(p => p.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
procs.forEach(p => p.on('exit', stop));
