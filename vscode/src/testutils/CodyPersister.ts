import { type Har } from '@pollyjs/persister'
import FSPersister from '@pollyjs/persister-fs'

import { decodeCompressedBase64 } from './base64'
import { PollyYamlWriter } from './pollyapi'

/**
 * The default file system persister with the following customizations
 *
 * - Replaces Cody access tokens with the string "REDACTED" because we don't
 *   want to commit the access token into git.
 * - To avoid diff churn/conflicts:
 *   - Sets date headers to a known static date
 *   - Removes cookies
 *   - Sets dates/timing information stored by Polly to static values
 */
export class CodyPersister extends FSPersister {
    // HACK: `FSPersister` has a private `api` property that writes the
    // recording.har file using JSON format. We override the `api` property here
    // with a custom implementation that uses YAML format instead. This property
    // is intentionally marked as public even if it's not used anywhere.
    public api: PollyYamlWriter

    constructor(polly: any) {
        super(polly)
        if (!this.options.recordingsDir) {
            throw new Error('No recording directory provided')
        }
        this.api = new PollyYamlWriter(this.options.recordingsDir)
    }
    public static get id(): string {
        return 'cody-fs'
    }

    public async onFindRecording(recordingId: string): Promise<Har | null> {
        const har = await super.onFindRecording(recordingId)
        if (har === null) {
            return har
        }
        for (const entry of har.log.entries) {
            const postData = entry?.request?.postData
            if (postData !== undefined && postData?.text === undefined && (postData as any)?.textJSON !== undefined) {
                // Format `postData.textJSON` back into the escaped string for the `.text` format.
                postData.text = JSON.stringify((postData as any).textJSON)
                ;(postData as any).textJSON = undefined
            }
        }
        return har
    }

    public onSaveRecording(recordingId: string, recording: Har): Promise<void> {
        const entries = recording.log.entries
        recording.log.entries.sort((a, b) => a.request.url.localeCompare(b.request.url))
        for (const entry of entries) {
            if (entry.request?.postData?.text?.startsWith('{')) {
                // Format `postData.text` as a JSON object instead of escaped string.
                // This makes it much easier to review the har file locally.
                const postData: any = entry.request.postData
                postData.textJSON = JSON.parse(entry.request.postData.text)
                postData.text = undefined
            }
            // Clean up the entries to reduce the size of the diff when re-recording
            // and to remove any access tokens.
            // Update any headers
            entry.request.bodySize = undefined
            entry.request.headersSize = 0
            entry.response.bodySize = undefined
            entry.response.headersSize = 0
            const headers = [...entry.request.headers, ...entry.response.headers]
            for (const header of headers) {
                switch (header.name) {
                    case 'authorization':
                        header.value = 'token REDACTED'
                        break
                    case 'date':
                        header.value = 'Fri, 05 Jan 2024 11:11:11 GMT'
                        break
                    case 'retry-after':
                        header.value = '0'
                        break
                    case 'x-cloud-trace-context':
                        header.value = 'e3280902f3d7c7e5307db550c8425e2c'
                }
            }

            // Remove any headers and cookies we don't need at all.
            entry.request.headers = this.filterHeaders(entry.request.headers)
            entry.response.headers = this.filterHeaders(entry.response.headers)
            entry.request.cookies.length = 0
            entry.response.cookies.length = 0

            // And other misc fields.
            entry.startedDateTime = 'Fri, 05 Jan 2024 00:00:00 GMT'
            entry.time = 0
            entry.timings = {
                blocked: -1,
                connect: -1,
                dns: -1,
                receive: 0,
                send: 0,
                ssl: -1,
                wait: 0,
            }
            const responseContent = entry.response.content
            if (
                responseContent?.encoding === 'base64' &&
                responseContent?.mimeType === 'application/json' &&
                responseContent.text
            ) {
                // The GraphQL responses are base64+gzip encoded. We decode them
                // in a sibling `textDecoded` property so we can more easily review
                // in in pull requests.
                try {
                    const text = JSON.parse(responseContent.text)[0]
                    const decodedBase64 = decodeCompressedBase64(text)
                    ;(responseContent as any).textDecoded = decodedBase64
                } catch {
                    // Ignored: uncomment below to debug. It's fine to ignore this error because we only
                    // make a best-effort to decode the gzip+base64 encoded JSON payload. It's not needed
                    // for the HTTP replay to work correctly because we leave the `.text` property unchanged.
                    // console.error('base64 decode error', error)
                }
            }
        }
        return super.onSaveRecording(recordingId, recording)
    }

    private filterHeaders(headers: { name: string; value: string }[]): { name: string; value: string }[] {
        const removeHeaderNames = new Set(['set-cookie', 'server', 'via'])
        const removeHeaderPrefixes = ['x-trace', 'cf-']
        return headers.filter(
            header =>
                !removeHeaderNames.has(header.name) &&
                removeHeaderPrefixes.every(prefix => !header.name.startsWith(prefix))
        )
    }
}
