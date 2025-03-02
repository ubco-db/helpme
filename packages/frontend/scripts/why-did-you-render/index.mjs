import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function injectWhyDidYouRender(config, context) {
  const injectionSource = path.join(__dirname, 'injection.js');

  if (context.dev && !context.isServer) {
    const originalEntry = config.entry;
    config.entry = async () => {
      const entries = await originalEntry();

      if (entries['main-app'] && !entries['main-app'].includes(injectionSource)) {
        entries['main-app'].unshift(injectionSource);
      }

      return entries;
    };
  }
}