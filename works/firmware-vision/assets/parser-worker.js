import { parseFirmware } from './parsers.js';

self.addEventListener('message', (event) => {
  const { buffer, name, size } = event.data;
  try {
    self.postMessage({ type: 'progress', message: '识别文件格式…' });
    const result = parseFirmware(buffer, { name, size });
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
