import { writable, get, derived } from 'svelte/store';
import ExpiryMap from 'expiry-map/dist';

const BUNDLE_DIR = 'Bundles2';

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

  private readonly registry = new FinalizationRegistry<string>(name => {
    console.debug(`[Bundle] garbage-collected, name: "${name}"`);
  });

  private readonly weakCache = new ExpiryMap<string, ArrayBuffer>(20 * 1000);

  // Patch version setter and cache management
  async setPatch(version: string) {
    const stateVal = get(this.state);
    if (stateVal.active) {
      await stateVal.active;
    }
    if (this.patchVer && this.patchVer !== version) {
      this.weakCache.clear();
      await caches.delete('bundles');
    }
    this.patchVer = version;
  }

  // Derived store to replace Vue's computed
  readonly progress = derived(this.state, $state => {
    return $state.isDownloading
      ? {
        totalSize: $state.totalSize,
        received: $state.received,
        bundleName: $state.bundleName
      }
      : null;
  });

  // Fetch file method with memory caching and network/disk fallback
  async fetchFile(name: string): Promise<ArrayBuffer> {
    let bundle = this.weakCache.get(name);
    if (bundle && bundle.byteLength !== 0) {
      console.log(`[Bundle] name: "${name}", source: memory.`);
      this.weakCache.set(name, bundle); // refresh TTL
      return bundle;
    }

    const stateVal = get(this.state);
    if (stateVal.active) {
      await stateVal.active;
      return await this.fetchFile(name); // Retry after active promise
    }

    const promise = this._fetchFile(name);
    this.state.update(state => ({ ...state, active: promise }));

    try {
      bundle = await promise;
      this.registry.register(bundle, name);
      this.weakCache.set(name, bundle);
      return bundle;
    } catch (e) {
      alert('You may need to adjust the patch version.');
      throw e;
    } finally {
      this.state.update(state => ({ ...state, active: null }));
    }
  }

  // Private method to handle the actual fetching and caching
  private async _fetchFile(name: string): Promise<ArrayBuffer> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stateVal = get(this.state);
    const path = `${this.patchVer}/${BUNDLE_DIR}/${name}`;
    const cache = await caches.open('bundles');
    let res = await cache.match(path);

    if (res) {
      console.log(`[Bundle] name: "${name}", source: disk cache.`);
    } else {
      console.log(`[Bundle] name: "${name}", source: network.`);

      this.state.update(state => ({
        ...state,
        totalSize: 0,
        received: 0,
        isDownloading: true,
        bundleName: name
      }));

      // res = await fetch(`https://poe-bundles.snos.workers.dev/${path}`);
      res = await fetch(`./_.index.bin`);
      if (res.status !== 200) {
        this.state.update(state => ({ ...state, isDownloading: false }));
        throw new Error(`patchcdn: ${res.status} ${res.statusText}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const totalSize = Number(res.headers.get('content-length'));

      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        this.state.update(state => ({ ...state, received }));
      }

      const buf = new Uint8Array(received);
      let bufPos = 0;
      for (const chunk of chunks) {
        buf.set(chunk, bufPos);
        bufPos += chunk.length;
      }

      this.state.update(state => ({ ...state, isDownloading: false }));

      await cache.put(path, new Response(buf, {
        headers: {
          'content-length': String(buf.byteLength),
          'content-type': 'application/octet-stream'
        }
      }));
      return buf.buffer;
    }

    return await res.arrayBuffer();
  }
}
