import * as Comlink from 'comlink';
import type { WorkerRPC } from './worker';
import type { DatFile } from 'pathofexile-dat/dat.js';

let thread: Comlink.Remote<WorkerRPC>;

if (!import.meta.env.SSR) {
  const Worker = (await import('./worker?worker')).default;
  thread = Comlink.wrap<WorkerRPC>(new Worker());
}

export async function decompressBundle(bundle: ArrayBuffer) {
  if (thread) {
    return await thread.decompressSliceInBundle(Comlink.transfer(bundle, [bundle]));
  }
  throw new Error("Worker is not available in SSR.");
}

export async function decompressFileInBundle(bundle: ArrayBuffer, offset: number, size: number) {
  if (thread) {
    return await thread.decompressSliceInBundle(Comlink.transfer(bundle, [bundle]), offset, size);
  }
  throw new Error("Worker is not available in SSR.");
}

export async function analyzeDatFile(datFile: DatFile, opts?: { transfer: true }) {
  if (thread) {
    return await thread.analyzeDatFile(Comlink.transfer(datFile, opts?.transfer ? [datFile.dataFixed.buffer] : []));
  }
  throw new Error("Worker is not available in SSR.");
}

export async function getBatchFileInfo(paths: string[], bundlesInfo: Uint8Array, filesInfo: Uint8Array) {
  if (thread) {
    return await thread.getBatchFileInfo(paths, bundlesInfo, filesInfo);
  }
  throw new Error("Worker is not available in SSR.");
}
