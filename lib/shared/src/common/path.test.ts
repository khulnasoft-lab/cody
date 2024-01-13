import { describe, expect, test } from 'vitest'
import { URI } from 'vscode-uri'

import { pathFunctionsForURI } from './path'

describe('pathFunctions', () => {
    describe('nonWindows', () => {
        const nonWindowsFSPath = pathFunctionsForURI(URI.file(''), false)
        test('dirname', () => {
            expect(nonWindowsFSPath.dirname('/foo/bar/baz')).toBe('/foo/bar')
            expect(nonWindowsFSPath.dirname('/foo/bar')).toBe('/foo')
            expect(nonWindowsFSPath.dirname('/foo/bar/')).toBe('/foo')
            expect(nonWindowsFSPath.dirname('/foo')).toBe('/')
            expect(nonWindowsFSPath.dirname('/foo/')).toBe('/')
            expect(nonWindowsFSPath.dirname('/')).toBe('/')
            expect(nonWindowsFSPath.dirname('')).toBe('.')
            expect(nonWindowsFSPath.dirname('foo')).toBe('.')
        })
        test('basename', () => {
            expect(nonWindowsFSPath.basename('/foo/bar/baz')).toBe('baz')
            expect(nonWindowsFSPath.basename('/foo/bar')).toBe('bar')
            expect(nonWindowsFSPath.basename('/foo/bar/')).toBe('bar')
            expect(nonWindowsFSPath.basename('/foo')).toBe('foo')
            expect(nonWindowsFSPath.basename('/foo/')).toBe('foo')
            expect(nonWindowsFSPath.basename('/')).toBe('')
            expect(nonWindowsFSPath.basename('')).toBe('')
            expect(nonWindowsFSPath.basename('foo')).toBe('foo')
        })
    })

    describe('windows', () => {
        const windowsFSPath = pathFunctionsForURI(URI.file(''), true)
        test('dirname', () => {
            expect(windowsFSPath.dirname('C:\\foo\\bar\\baz')).toBe('C:\\foo\\bar')
            expect(windowsFSPath.dirname('C:\\foo\\bar')).toBe('C:\\foo')
            expect(windowsFSPath.dirname('C:\\foo')).toBe('C:\\')
            expect(windowsFSPath.dirname('C:\\foo\\')).toBe('C:\\')
            expect(windowsFSPath.dirname('C:\\')).toBe('C:\\')
            expect(windowsFSPath.dirname('C:')).toBe('C:')
            expect(windowsFSPath.dirname('foo\\bar')).toBe('foo')
            expect(windowsFSPath.dirname('\\foo\\bar')).toBe('\\foo')
            expect(windowsFSPath.dirname('foo')).toBe('.')
            expect(windowsFSPath.dirname('\\foo')).toBe('\\')
        })
        test('basename', () => {
            expect(windowsFSPath.basename('C:\\foo\\bar\\baz')).toBe('baz')
            expect(windowsFSPath.basename('C:\\foo\\bar')).toBe('bar')
            expect(windowsFSPath.basename('C:\\foo')).toBe('foo')
            expect(windowsFSPath.basename('C:\\foo\\')).toBe('foo')
            expect(windowsFSPath.basename('C:\\')).toBe('')
            expect(windowsFSPath.basename('C:')).toBe('')
            expect(windowsFSPath.basename('')).toBe('')
            expect(windowsFSPath.basename('foo\\bar')).toBe('bar')
            expect(windowsFSPath.basename('\\foo\\bar')).toBe('bar')
            expect(windowsFSPath.basename('foo')).toBe('foo')
            expect(windowsFSPath.basename('\\foo')).toBe('foo')
        })
    })

    test('extname', () => {
        // extname does not differ in behavior on Windows vs. non-Windows, so we don't need to test
        // it for both platforms.
        const extname = pathFunctionsForURI(URI.file(''), false).extname
        expect(extname('/foo/bar/baz.ts')).toBe('.ts')
        expect(extname('/foo/bar.XX')).toBe('.XX')
        expect(extname('/foo/.a')).toBe('')
        expect(extname('/foo/.index.md')).toBe('.md')
        expect(extname('baz.test.ts')).toBe('.ts')
        expect(extname('a')).toBe('')
        expect(extname('a.')).toBe('.')
    })
})
