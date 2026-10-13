import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
const path = (parts: (string | { uri: string })[]) =>
  join(...parts.map((p) => (typeof p === "string" ? p : p.uri)));
/** Only the Expo file transport is replaced; backup format, checksums and lifecycle run unchanged. */
export class NativeDirectory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = path(parts);
  }
  get exists() {
    return existsSync(this.uri);
  }
  create() {
    mkdirSync(this.uri, { recursive: true });
  }
  list() {
    return readdirSync(this.uri).map((name) =>
      statSync(join(this.uri, name)).isDirectory()
        ? new NativeDirectory(this, name)
        : new NativeFile(this, name),
    );
  }
}
export class NativeFile {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = path(parts);
  }
  get exists() {
    return existsSync(this.uri);
  }
  get name() {
    return basename(this.uri);
  }
  get size() {
    return this.exists ? statSync(this.uri).size : 0;
  }
  get parentDirectory() {
    return new NativeDirectory(dirname(this.uri));
  }
  async bytes() {
    return new Uint8Array(readFileSync(this.uri));
  }
  async text() {
    return readFileSync(this.uri, "utf8");
  }
  write(bytes: Uint8Array | string) {
    writeFileSync(this.uri, bytes);
  }
  move(destination: NativeFile) {
    renameSync(this.uri, destination.uri);
    this.uri = destination.uri;
  }
  delete() {
    rmSync(this.uri, { force: true });
  }
}
