const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  'src',
  'essay-feedback',
  'prompts',
  'prompt.md',
);
const dstDir = path.join(__dirname, 'dist', 'assignment-feedback', 'prompts');
const dst = path.join(dstDir, 'prompt.md');

if (fs.existsSync(src)) {
  fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(src, dst);
}
