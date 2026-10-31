#!/usr/bin/env node
// Страховка сборки: если в репозитории остался закоммиченный (и неполный) node_modules,
// Vercel не переустанавливает пакеты с нуля, и сборка падает с ERR_MODULE_NOT_FOUND.
// Этот скрипт перед `vite build` проверяет ключевые файлы пакетов и, при их отсутствии,
// полностью пересоздаёт node_modules из package-lock.json.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const checks = [
  'node_modules/vite/dist/node/cli.js',
  'node_modules/@vitejs/plugin-react/dist/index.js',
  'node_modules/@supabase/supabase-js/dist/cors.mjs',
  'node_modules/react/index.js',
  'node_modules/react-dom/index.js',
];

const missing = checks.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length === 0) {
  console.log('[fix-node-modules] зависимости в порядке, пропускаю.');
  process.exit(0);
}

console.log('[fix-node-modules] обнаружены повреждённые пакеты:\n  - ' + missing.join('\n  - '));
console.log('[fix-node-modules] удаляю node_modules и переустанавливаю из package-lock.json...');
fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true });
execSync('npm ci --include=dev', { stdio: 'inherit', cwd: root });

const stillMissing = checks.filter((f) => !fs.existsSync(path.join(root, f)));
if (stillMissing.length > 0) {
  console.error('[fix-node-modules] переустановка не помогла:', stillMissing.join(', '));
  process.exit(1);
}
console.log('[fix-node-modules] node_modules восстановлен успешно.');
