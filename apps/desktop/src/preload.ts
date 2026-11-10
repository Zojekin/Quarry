import { contextBridge } from 'electron';

const argument = process.argv.find(value => value.startsWith('--quarry-api-url='));
const url = argument?.slice('--quarry-api-url='.length);
if (!url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) {
  throw new Error('Missing or invalid local backend URL');
}
contextBridge.exposeInMainWorld('__QUARRY_API_URL__', url);
