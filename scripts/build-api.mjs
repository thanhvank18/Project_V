import { build } from 'esbuild';
await build({ entryPoints: ['backend/rooms.mjs'], outfile: 'backend/rooms.bundle.cjs', bundle: true,
  platform: 'node', target: 'node24', format: 'cjs', minify: false,
  external: ['bufferutil', 'utf-8-validate'], logLevel: 'warning' });
console.log('Authoritative room server bundled.');
