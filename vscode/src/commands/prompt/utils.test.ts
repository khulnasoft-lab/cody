import { describe, expect, it } from 'vitest'
import { URI } from 'vscode-uri'

import { extractTestType, isValidTestFileName } from './utils'

describe('extractTestType', () => {
    it('extracts "unit" from test type', () => {
        const text = 'add unit tests here'
        const expected = 'unit'

        const result = extractTestType(text)

        expect(result).toEqual(expected)
    })

    it('extracts "e2e" from test type', () => {
        const text = 'missing e2e test coverage'
        const expected = 'e2e'

        const result = extractTestType(text)

        expect(result).toEqual(expected)
    })

    it('extracts "integration" from test type', () => {
        const text = 'needs more integration testing'
        const expected = 'integration'

        const result = extractTestType(text)

        expect(result).toEqual(expected)
    })

    it('returns empty string if no match', () => {
        const text = 'test this function'
        const expected = ''

        const result = extractTestType(text)

        expect(result).toEqual(expected)
    })
})

describe('isValidTestFileName', () => {
    it.each([
        ['testFile.java', false],
        ['testFile.js', false],
        ['test_file.py', true],
        ['test-file.js', false],
        ['node_modules/file.js', false],
        ['file.js', false],

        // Examples from various programming languages
        ['test_example.py', true],
        ['example.test.js', true],
        ['ExampleTest.java', true],
        ['example_spec.rb', true],
        ['ExampleTest.cs', true],
        ['ExampleTest.php', true],
        ['ExampleSpec.scala', true],
        ['example_test.go', true],
        ['ExampleTest.kt', true],
        ['ExampleTests.swift', true],
        ['example.spec.ts', true],
        ['ExampleTest.pl', true],
        ['example_test.rs', true],
        ['ExampleSpec.groovy', true],
        ['example_test.cpp', true],
        ['example_test.js', true],
        ['test_example.rb', true],

        ['contest.ts', false],
    ])('for filename %j it returns %j', (path, condition) => {
        expect(isValidTestFileName(URI.parse(`file:///${path}`))).toBe(condition)
    })
})
