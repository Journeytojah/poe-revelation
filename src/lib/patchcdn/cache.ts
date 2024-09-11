import { writable, get, derived } from 'svelte/store';
import ExpiryMap from 'expiry-map/dist';  // For caching the bundles

const BUNDLE_DIR = 'Bundles2';  // Directory for bundles

export class BundleLoader {
  private patchVer = '';

  // State store to replace shallowReactive
  private readonly state = writable({
    totalSize: 0,
    received: 0,
    bundleName: '',
    isDownloading: false,
    active: null as Promise<unknown> | null
  });

  // For tracking memory usage and garbage collection
  private readonly registry = new FinalizationRegistry<string>((name) => {
    console.debug(`[Bundle] garbage-collected, name: "${name}"`);
  });

  // Caching bundles in memory for a limited time
  private readonly weakCache = new ExpiryMap<string, ArrayBuffer>(20 * 1000);

  // Set the patch version and clear old cache if necessary
  async setPatch(version: string) {
    const stateVal = get(this.state);
    if (stateVal.active) {
      await stateVal.active;
    }
    if (this.patchVer && this.patchVer !== version) {
      this.weakCache.clear();
      await caches.delete('bundles');  // Clear cache if patch version changes
    }
    this.patchVer = version;
  }

  // Derived store for download progress
  readonly progress = derived(this.state, ($state) => {
    return $state.isDownloading
      ? {
        totalSize: $state.totalSize,
        received: $state.received,
        bundleName: $state.bundleName,
      }
      : null;
  });

  // Fetch file from memory, disk cache, or network
  async fetchFile(name: string): Promise<ArrayBuffer> {
    // First, try to fetch from memory cache
    let bundle = this.weakCache.get(name);
    if (bundle && bundle.byteLength !== 0) {
      console.log(`[Bundle] name: "${name}", source: memory.`);
      this.weakCache.set(name, bundle);  // Refresh TTL
      return bundle;
    }

    const stateVal = get(this.state);
    if (stateVal.active) {
      await stateVal.active;  // Wait for any active file being fetched
      return await this.fetchFile(name);  // Retry after active promise resolves
    }

    const promise = this._fetchFile(name);
    this.state.update((state) => ({ ...state, active: promise }));

    try {
      bundle = await promise;  // Wait for file to be fetched
      this.registry.register(bundle, name);  // Register for garbage collection
      this.weakCache.set(name, bundle);  // Store in memory cache
      return bundle;
    } catch (e) {
      alert('You may need to adjust the patch version.');
      throw e;
    } finally {
      this.state.update((state) => ({ ...state, active: null }));
    }
  }

  // Private method to actually handle the fetching
  private async _fetchFile(name: string): Promise<ArrayBuffer> {
    const path = `${this.patchVer}/${BUNDLE_DIR}/${name}`;
    const cache = await caches.open('bundles');
    let res = await cache.match(path);

    if (res) {
      // File found in disk cache
      console.log(`[Bundle] name: "${name}", source: disk cache.`);
    } else {
      // File needs to be fetched from network
      console.log(`[Bundle] name: "${name}", source: network.`);
      this.state.update((state) => ({
        ...state,
        totalSize: 0,
        received: 0,
        isDownloading: true,
        bundleName: name,
      }));

      // Network fetch request
      // res = await fetch(`https://poe-bundles.snos.workers.dev/${path}`);
      res = await fetch('/_.index.bin')
      if (res.status !== 200) {
        this.state.update((state) => ({ ...state, isDownloading: false }));
        throw new Error(`patchcdn: ${res.status} ${res.statusText}`);
      }

      // const totalSize = Number(res.headers.get('content-length'));
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      // Read the response in chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        this.state.update((state) => ({ ...state, received }));
      }

      const buf = new Uint8Array(received);
      let bufPos = 0;
      for (const chunk of chunks) {
        buf.set(chunk, bufPos);
        bufPos += chunk.length;
      }

      // Save response to disk cache
      await cache.put(path, new Response(buf, {
        headers: {
          'content-length': String(buf.byteLength),
          'content-type': 'application/octet-stream',
        },
      }));

      // Update state to mark download complete
      this.state.update((state) => ({ ...state, isDownloading: false }));

      return buf.buffer;
    }

    return await res.arrayBuffer();  // Return ArrayBuffer of the file
  }
}
