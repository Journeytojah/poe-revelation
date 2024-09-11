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

    console.log('Index loaded:', _index);  // Log the entire index structure

    this.index.set({
      bundlesInfo: _index.bundlesInfo,
      filesInfo: _index.filesInfo,
      dirsInfo: _index.dirsInfo,
      pathReps,
    });

    // Log filesInfo to check if .dat64 files are indexed
    console.log('Files Info:', _index.filesInfo);
  }

  // Load file content based on filePath
  async loadFileContent(fullPath: string) {
    const { bundlesInfo, filesInfo } = get(this.index)!;
    
    const location = getFileInfo(fullPath, bundlesInfo, filesInfo)
    const bundleBin = await this.loader.fetchFile(location.bundle)

    const { slice } = await decompressFileInBundle(bundleBin.slice(0), location.offset, location.size)
    return slice
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

  // Reactively watch index updates
  watch(cb: () => void) {
    this.index.subscribe(cb); // Use the store's subscription mechanism
  }
}
