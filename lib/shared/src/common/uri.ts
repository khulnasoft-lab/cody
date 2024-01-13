import { type URI } from 'vscode-uri'

import { posixAndURIPaths } from './path'

/**
 * dirname, but operates on a {@link URI}'s path.
 *
 * Use this instead of Node's `path` module because on Windows, Node `path` uses '\' as path
 * separators, which will break because URI paths are always separated with '/'.
 */
export function uriDirname(uri: URI): string {
    return posixAndURIPaths.dirname(uri.path)
}

/**
 * basename, but operates on a {@link URI}'s path.
 *
 * See {@link uriDirname} for why we use this instead of Node's `path` module.
 */
export function uriBasename(uri: URI, suffix?: string): string {
    return posixAndURIPaths.basename(uri.path, suffix)
}

/**
 * extname, but operates on a {@link URI}'s path.
 *
 * See {@link uriDirname} for why we use this instead of Node's `path` module.
 */
export function uriExtname(uri: URI): string {
    return posixAndURIPaths.extname(uri.path)
}

/**
 * A file URI.
 *
 * It is helpful to use the {@link FileURI} type instead of just {@link URI} or {@link vscode.Uri}
 * when the URI is known to be `file`-scheme-only.
 */
export type FileURI = URI & { scheme: 'file' }

declare module 'vscode-uri' {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    export class URI {
        public static file(fsPath: string): FileURI
    }
}
