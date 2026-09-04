import { spawn } from 'node:child_process';

// Ambos procesos deben vivir y morir juntos: una API sin worker deja trabajos pendientes.
const children = new Set();
let stopping = false;
let killTimer;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill('SIGTERM');
  killTimer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 10_000);
  killTimer.unref();
}

process.once('SIGTERM', () => stop(0));
process.once('SIGINT', () => stop(0));

for (const [name, file] of [
  ['api', 'dist/main.js'],
  ['worker', 'dist-worker/export-worker.js'],
]) {
  const child = spawn(process.execPath, [file], { stdio: 'inherit', env: process.env });
  children.add(child);
  child.once('error', (error) => {
    console.error(`No se pudo iniciar ${name}: ${error.message}`);
    stop(1);
  });
  child.once('close', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} terminó inesperadamente (code=${code}, signal=${signal}).`);
      stop(code || 1);
    }
    if (children.size === 0) clearTimeout(killTimer);
  });
}
