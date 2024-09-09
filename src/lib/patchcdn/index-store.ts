import { writable, get } from 'svelte/store'; // Replace shallowRef with writable store
import { getDirContent, getRootDirs, getFileInfo, readIndexBundle } from 'pathofexile-dat/bundles.js';
import { decompressBundle, decompressFileInBundle, getBatchFileInfo } from '../worker/interface.js';
import type { BundleLoader } from './cache.js';
import * as perf from '../perf.js'; // Adjust the path based on your project structure

export class BundleIndex {
  // Using writable store for index state
  private readonly index = writable<{
    bundlesInfo: Uint8Array;
    filesInfo: Uint8Array;
    dirsInfo: Uint8Array;
    pathReps: Uint8Array;
  } | null>(null);

  constructor(public readonly loader: BundleLoader) { }

  // Check if the index is loaded
  get isLoaded() {
    return get(this.index) != null;
  }

  // Load index bundle and decompress
  async loadIndex() {
    const indexBin = await this.loader.fetchFile('_.index.bin');
    const { slice: indexBundle } = await decompressBundle(indexBin);
    const _index = readIndexBundle(indexBundle);
    const { slice: pathReps } = await decompressBundle(_index.pathRepsBundle.slice().buffer);

    this.index.set({
      bundlesInfo: _index.bundlesInfo,
      filesInfo: _index.filesInfo,
      dirsInfo: _index.dirsInfo,
      pathReps
    });
  }

  // Load file content based on its full path
  async loadFileContent(fullPath: string) {
    const index = get(this.index);
    if (!index) {
      throw new Error('Index is not loaded.');
    }

    const { bundlesInfo, filesInfo } = index;
    const location = getFileInfo(fullPath, bundlesInfo, filesInfo);
    if (!location) {
      throw new Error(`File not found for path: ${fullPath}`);
    }

    const bundleBin = await this.loader.fetchFile(location.bundle);
    const { slice } = await decompressFileInBundle(bundleBin.slice(0), location.offset, location.size);
    return slice;
  }

  // Get directory content for a given path
  getDirContent(dirPath: string) {
    const { pathReps, dirsInfo } = get(this.index)!;
    return perf.fn(`[Index] getting "${dirPath}" dir`, () =>
      getDirContent(dirPath, pathReps, dirsInfo)
    );
  }

  // Get the root directories
  getRootDirs() {
    const { pathReps, dirsInfo } = get(this.index)!;
    return perf.fn('[Index] getting root dirs', () =>
      getRootDirs(pathReps, dirsInfo)
    );
  }

  // Get batch file info for multiple paths
  async getBatchFileInfo(paths: string[]) {
    const { bundlesInfo, filesInfo } = get(this.index)!;
    return await getBatchFileInfo(paths, bundlesInfo, filesInfo);
  }

  // Reactively watch index updates (similar to Vue's watch)
  watch(cb: () => void) {
    this.index.subscribe(cb); // Use the store's subscription mechanism
  }
}
