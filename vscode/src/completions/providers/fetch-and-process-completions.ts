import { type CompletionResponse } from '@sourcegraph/cody-shared/src/sourcegraph-api/completions/types'

import { addAutocompleteDebugEvent } from '../../services/open-telemetry/debug-utils'
import { canUsePartialCompletion } from '../can-use-partial-completion'
import { type CodeCompletionsClient, type CodeCompletionsParams } from '../client'
import { type DocumentContext } from '../get-current-doc-context'
import { getFirstLine } from '../text-processing'
import { parseAndTruncateCompletion } from '../text-processing/parse-and-truncate-completion'
import {
    processCompletion,
    type InlineCompletionItemWithAnalytics,
} from '../text-processing/process-inline-completions'
import { forkSignal } from '../utils'

import { getUpdatedDocContext } from './dynamic-multiline'
import { createHotStreakExtractor, type HotStreakExtractor } from './hot-streak'
import { type ProviderOptions } from './provider'

export interface FetchAndProcessCompletionsParams {
    client: Pick<CodeCompletionsClient, 'complete'>
    requestParams: CodeCompletionsParams
    abortSignal: AbortSignal
    providerSpecificPostProcess: (insertText: string) => string
    providerOptions: Readonly<ProviderOptions>

    onCompletionReady: (completions: InlineCompletionItemWithAnalytics) => void
    onHotStreakCompletionReady: (docContext: DocumentContext, completions: InlineCompletionItemWithAnalytics) => void
}

/**
 * Uses the first line of the completion to figure out if it start the new multiline syntax node.
 * If it does, continues streaming until the completion is truncated or we reach the token sample limit.
 */
export async function fetchAndProcessDynamicMultilineCompletions(
    params: FetchAndProcessCompletionsParams
): Promise<void> {
    const { client, requestParams, abortSignal, providerOptions, providerSpecificPostProcess } = params
    const { multiline, docContext } = providerOptions

    let completedCompletion: undefined | InlineCompletionItemWithAnalytics
    let hotStreakExtractor: undefined | HotStreakExtractor

    // The Async executor is required to return the completion early if a partial result from SSE can be used.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            const abortController = forkSignal(abortSignal)

            function stopStreamingAndUsePartialResponse(completionItem: InlineCompletionItemWithAnalytics): void {
                completedCompletion = completionItem
                params.onCompletionReady({ ...completionItem, stopReason: 'streaming-truncation' })
                resolve()
                abortController.abort()

                if (providerOptions.hotStreak) {
                    hotStreakExtractor = createHotStreakExtractor({
                        completedCompletion,
                        ...params,
                    })
                } else {
                    abortController.abort()
                }
            }

            const result = await client.complete(
                requestParams,
                (incompleteResponse: CompletionResponse) => {
                    const rawCompletion = providerSpecificPostProcess(incompleteResponse.completion)

                    addAutocompleteDebugEvent('incomplete_response', {
                        multiline,
                        currentLinePrefix: docContext.currentLinePrefix,
                        text: rawCompletion,
                    })

                    if (completedCompletion) {
                        hotStreakExtractor?.extract(rawCompletion, false)
                    }

                    /**
                     * This completion was triggered with the multiline trigger at the end of current line.
                     * Process it as the usual multline completion: continue streaming until it's truncated.
                     */
                    if (multiline) {
                        addAutocompleteDebugEvent('multline_branch')
                        const completion = canUsePartialCompletion(rawCompletion, {
                            document: providerOptions.document,
                            docContext,
                        })

                        if (completion) {
                            const processedCompletion = processCompletion(completion, providerOptions)
                            stopStreamingAndUsePartialResponse(processedCompletion)
                        }
                    } else {
                        /**
                         * This completion was started without the multiline trigger at the end of current line.
                         * Check if the the first completion line ends with the multiline trigger. If that's the case
                         * continue streaming and pretend like this completion was multiline in the first place:
                         *
                         * 1. Update `docContext` with the `multilineTrigger` value.
                         * 2. Set the cursor position to the multiline trigger.
                         */
                        const updatedDocContext = getUpdatedDocContext({
                            ...params,
                            initialCompletion: rawCompletion,
                        })

                        if (updatedDocContext.multilineTrigger) {
                            const completion = canUsePartialCompletion(rawCompletion, {
                                document: providerOptions.document,
                                docContext: updatedDocContext,
                                isDynamicMultilineCompletion: true,
                            })

                            if (completion) {
                                addAutocompleteDebugEvent('isMultilineBasedOnFirstLine_resolve', {
                                    currentLinePrefix: updatedDocContext.currentLinePrefix,
                                    text: completion.insertText,
                                })

                                const processedCompletion = processCompletion(
                                    {
                                        ...completion,
                                        insertText: completion.insertText,
                                    },
                                    {
                                        ...providerOptions,
                                        docContext: updatedDocContext,
                                    }
                                )

                                stopStreamingAndUsePartialResponse(processedCompletion)
                            }
                        } else {
                            /**
                             * This completion was started without the multiline trigger at the end of current line
                             * and the first generated line does not end with a multiline trigger.
                             *
                             * Process this completion as a singleline completion: cut-off after the first new line char.
                             */
                            const completion = canUsePartialCompletion(rawCompletion, providerOptions)

                            if (completion) {
                                const firstLine = getFirstLine(completion.insertText)

                                addAutocompleteDebugEvent('singleline resolve', {
                                    currentLinePrefix: docContext.currentLinePrefix,
                                    text: firstLine,
                                })

                                const processedCompletion = processCompletion(
                                    {
                                        ...completion,
                                        insertText: firstLine,
                                    },
                                    providerOptions
                                )

                                stopStreamingAndUsePartialResponse(processedCompletion)
                            }
                        }
                    }
                },
                abortController.signal
            )

            if (abortController.signal.aborted) {
                return
            }

            /**
             * We were not able to use a partial streaming response as a completion and receive the full
             * completion text generated by the LLM.
             */
            const rawCompletion = providerSpecificPostProcess(result.completion)

            if (!completedCompletion) {
                addAutocompleteDebugEvent('full_response', {
                    currentLinePrefix: docContext.currentLinePrefix,
                    text: rawCompletion,
                })

                const updatedDocContext = getUpdatedDocContext({
                    ...params,
                    initialCompletion: rawCompletion,
                })

                const completion = parseAndTruncateCompletion(rawCompletion, {
                    document: providerOptions.document,
                    docContext: updatedDocContext,
                })

                addAutocompleteDebugEvent('full_response_resolve', {
                    currentLinePrefix: updatedDocContext.currentLinePrefix,
                    text: completion.insertText,
                })

                completedCompletion = processCompletion(completion, {
                    document: providerOptions.document,
                    position: updatedDocContext.position,
                    docContext: updatedDocContext,
                })

                params.onCompletionReady({ ...completedCompletion, stopReason: result.stopReason })
                resolve()
                abortController.abort()

                if (params.providerOptions.hotStreak) {
                    hotStreakExtractor = createHotStreakExtractor({
                        completedCompletion,
                        ...params,
                    })
                }
            }

            hotStreakExtractor?.extract(rawCompletion, true)
        } catch (error) {
            reject(error)
        }
    })
}

export async function fetchAndProcessCompletions(params: FetchAndProcessCompletionsParams): Promise<void> {
    const { client, requestParams, abortSignal, providerOptions, providerSpecificPostProcess } = params

    let completedCompletion: undefined | InlineCompletionItemWithAnalytics
    let hotStreakExtractor: undefined | HotStreakExtractor

    // The Async executor is required to return the completion early if a partial result from SSE can be used.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            const abortController = forkSignal(abortSignal)
            const result = await client.complete(
                requestParams,
                (incompleteResponse: CompletionResponse) => {
                    const rawCompletion = providerSpecificPostProcess(incompleteResponse.completion)

                    if (!completedCompletion) {
                        const completion = canUsePartialCompletion(rawCompletion, providerOptions)
                        if (completion) {
                            completedCompletion = processCompletion(completion, providerOptions)
                            params.onCompletionReady({ ...completedCompletion, stopReason: 'streaming-truncation' })
                            resolve()

                            if (params.providerOptions.hotStreak) {
                                hotStreakExtractor = createHotStreakExtractor({
                                    completedCompletion,
                                    ...params,
                                })
                            }
                        } else {
                            // If we don't have a complete completion yet and the current chunk is
                            // not enough to be used as a completion, we wait for the next chunk.
                            return
                        }
                    }

                    if (params.providerOptions.hotStreak) {
                        hotStreakExtractor?.extract(rawCompletion, false)
                    } else {
                        abortController.abort()
                    }
                },
                abortController.signal
            )

            const rawCompletion = providerSpecificPostProcess(result.completion)

            if (!completedCompletion) {
                const completion = parseAndTruncateCompletion(rawCompletion, providerOptions)
                completedCompletion = processCompletion(completion, providerOptions)
                params.onCompletionReady({ ...completedCompletion, stopReason: result.stopReason })

                if (params.providerOptions.hotStreak) {
                    hotStreakExtractor = createHotStreakExtractor({
                        completedCompletion,
                        ...params,
                    })
                }
            }

            hotStreakExtractor?.extract(rawCompletion, true)

            resolve()
        } catch (error) {
            reject(error)
        }
    })
}
