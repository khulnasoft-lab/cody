import { type URI } from 'vscode-uri'

import { isWindows as _isWindows } from './platform'

export interface PathFunctions {
    /**
     * All but the last element of path, or "." if that would be the empty path.
     */
    dirname: (path: string) => string

    /**
     * The last element of path, or "" if path is empty.
     * @param path the path to operate on
     * @param suffix optional suffix to remove
     */
    basename: (path: string, suffix?: string) => string

    /** The extension of path, including the last '.'. */
    extname: (path: string) => string

    /** Path separator. */
    separator: string
}

/** For file system paths on Windows ('\' separators and drive letters). */
export const windowsFilePaths: PathFunctions = pathFunctions(true)

/**
 * For POSIX and URI paths ('/' separators).
 */
export const posixAndURIPaths: PathFunctions = pathFunctions(false)

/**
 * Get the {@link PathFunctions} to use for the given URI's path.
 */
export function pathFunctionsForURI(uri: URI, isWindows = _isWindows()): PathFunctions {
    return uri.scheme === 'file' && isWindows ? windowsFilePaths : posixAndURIPaths
}

function pathFunctions(isWindows: boolean): PathFunctions {
    const sep = isWindows ? '\\' : '/'
    const f: PathFunctions = {
        dirname(path: string): string {
            if (path === '') {
                return '.'
            }
            if (isWindows && isDriveLetter(path)) {
                return path
            }
            if (path.endsWith(sep)) {
                path = path.slice(0, -1)
            }
            if (isWindows && isDriveLetter(path)) {
                return path + sep
            }
            if (path === '') {
                return sep
            }
            const i = path.lastIndexOf(sep)
            if (i === -1) {
                return '.'
            }
            if (i === 0) {
                return sep
            }
            path = path.slice(0, i)
            if (isWindows && isDriveLetter(path)) {
                return path + sep
            }
            return path
        },
        basename(path: string, suffix?: string): string {
            if (path.endsWith(sep)) {
                path = path.slice(0, -1)
            }
            if (isWindows && isDriveLetter(path)) {
                return ''
            }
            path = path.split(sep).at(-1) ?? ''
            if (suffix && path.endsWith(suffix)) {
                path = path.slice(0, -suffix.length)
            }
            return path
        },
        extname(path: string): string {
            const basename = f.basename(path)
            const i = basename.lastIndexOf('.')
            if (i === 0 || i === -1) {
                return ''
            }
            return basename.slice(i)
        },
        separator: sep,
    }
    return f
}

function isDriveLetter(path: string): boolean {
    return /^[A-Za-z]:$/.test(path)
}
