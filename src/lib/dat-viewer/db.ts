import { openDB, type DBSchema } from 'idb/build/index.js';
import { writable, get } from 'svelte/store'; // Svelte store instead of shallowRef
import { type SchemaFile, SCHEMA_VERSION } from 'pathofexile-dat-schema';
import { fromSerializedHeaders, type Header } from './headers.js';
import type { BundleIndex } from '../patchcdn/index-store.js'; // Adjust the path
import { decompressFileInBundle, analyzeDatFile } from '../worker/interface.js'; // Adjust the path

import { readDatFile } from 'pathofexile-dat/dat.js';



export type ViewerSerializedHeader = Omit<Header, 'offset' | 'length'> & { length?: number };

interface DatSchema {
  name: string;
  headers: ViewerSerializedHeader[];
}

interface PoeDatViewerSchema extends DBSchema {
  'dat-schemas': {
    key: DatSchema['name'];
    value: DatSchema;
  };
}

export interface TableStats {
  name: string;
  totalRows: number;
  headersValid: boolean;
  increasedRowLength: boolean;
}

export class DatSchemasDatabase {
  private readonly publicSchema = writable<SchemaFile['tables']>([]);
  private readonly _isLoading = writable(false);
  private readonly _tableStats = writable<TableStats[]>([]);

  get isLoaded() {
    return get(this.publicSchema).length > 0;
  }

  get isLoading() {
    return get(this._isLoading);
  }

  get tableStats() {
    return get(this._tableStats) as readonly TableStats[];
  }

  constructor(private readonly index: BundleIndex) { }

  private readonly db = openDB<PoeDatViewerSchema>('poe-dat-viewer', 3, {
    upgrade(db) {
      db.createObjectStore('dat-schemas', { keyPath: 'name' });
    },
  });

  async fetchSchema() {
    this._isLoading.set(true);
    // const response = await fetch('https://poe-bundles.snos.workers.dev/schema.min.json');
    const response = await fetch('/schema.min.json');
    const schema: SchemaFile = await response.json();

    console.log('Schema loaded:', schema);
    
    if (schema.version === SCHEMA_VERSION) {
      this.publicSchema.set(schema.tables);
    } else {
      console.warn('Latest schema version is not supported.');
    }
    this._isLoading.set(false);
  }

  async findSchemaByName(name: string): Promise<DatSchema | null> {
    const record = await (await this.db).get('dat-schemas', name);
    return record ?? fromPublicSchema(name, get(this.publicSchema));
  }

  async findByName(name: string) {
    const schema = await this.findSchemaByName(name);
    return schema?.headers ?? [];
  }

  async saveHeaders(name: string, headers: Header[]) {
    await (await this.db).put('dat-schemas', {
      name,
      headers: serializeHeaders(headers),
    });
  }

  async removeHeaders(name: string) {
    await (await this.db).delete('dat-schemas', name);
  }

  async preloadDataTables(totalTables: { set: (value: number) => void }) {
    const dirContent = this.index.getDirContent('data');
    const filePaths = dirContent ? dirContent.files.filter((file) => file.endsWith('.dat64')) : [];

    totalTables.set(filePaths.length);

    const filesInfo = await this.index.getBatchFileInfo(filePaths);

    const byBundle = filesInfo.reduce<
      Array<{ name: string; files: Array<{ fullPath: string; location: { offset: number; size: number } }> }>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    >((byBundle: { name: any; files: { fullPath: string; location: any; }[]; }[], location: { bundle: any; }, idx: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = byBundle.find((bundle: { name: any; }) => bundle.name === location.bundle);
      const fullPath = filePaths[idx];
      if (found) {
        found.files.push({ fullPath, location });
      } else {
        byBundle.push({
          name: location.bundle,
          files: [{ fullPath, location }],
        });
      }
      return byBundle;
    }, []);

    for (const bundle of byBundle) {
      let bundleBin = await this.index.loader.fetchFile(bundle.name);
      for (const { fullPath, location } of bundle.files) {
        const res = await decompressFileInBundle(bundleBin, location.offset, location.size);
        bundleBin = res.bundle;

        const datFile = readDatFile(fullPath, res.slice);

        const columnStats = await analyzeDatFile(datFile, { transfer: true });
        const name = fullPath.replace('data/', '').replace('.dat64', '');

        const schema = await this.findSchemaByName(name);
        const headers = fromSerializedHeaders(schema?.headers ?? [], columnStats, datFile);

        this._tableStats.update((stats) => [
          ...stats,
          {
            name: schema?.name ?? name,
            totalRows: datFile ? datFile.rowCount : 0,
            headersValid: headers != null,
            increasedRowLength: headers ? headers.increasedRowLength : false,
          },
        ]);
      }
    }
  }
}

function serializeHeaders(headers: Header[]) {
  return headers.map<ViewerSerializedHeader>((header) => ({
    ...header,
    length:
      header.type.string ||
        header.type.array ||
        header.type.key ||
        header.type.boolean ||
        header.type.decimal ||
        header.type.integer
        ? undefined
        : header.length,
  }));
}

function fromPublicSchema(name: string, publicSchema: SchemaFile['tables']): DatSchema | null {
  name = name.toLowerCase();
  const sch = publicSchema.find((s) => s.name.toLowerCase() === name);
  if (!sch) return null;

  const headers: ViewerSerializedHeader[] = sch.columns.map((column) => ({
    name: column.name || '',
    type: {
      array: column.array,
      byteView: column.type === 'array' ? { array: true } : undefined,
      integer: column.type === 'i32' ? { unsigned: false, size: 4 } : column.type === 'enumrow' ? { unsigned: false, size: 4 } : undefined,
      decimal: column.type === 'f32' ? { size: 4 } : undefined,
      string: column.type === 'string' ? {} : undefined,
      boolean: column.type === 'bool' ? {} : undefined,
      key: column.type === 'row' || column.type === 'foreignrow' ? { foreign: column.type === 'foreignrow', table: column.references?.table ?? null, viewColumn: null } : undefined,
    },
    textLength: 4 * 3 - 1,
  }));

  return {
    name: sch.name,
    headers,
  };
}
