import { type ContextFile, type PreciseContext } from '../../codebase-context/messages'
import { type CodyDefaultCommands } from '../../commands'
import { type Message } from '../../sourcegraph-api'
import { type RecipeID } from '../recipes/recipe'

import { type TranscriptJSON } from '.'

export interface ChatButton {
    label: string
    action: string
    onClick: (action: string) => void
    appearance?: 'primary' | 'secondary' | 'icon'
}

export interface ChatMessage extends Message {
    displayText?: string
    contextFiles?: ContextFile[]
    preciseContext?: PreciseContext[]
    buttons?: ChatButton[]
    data?: any
    metadata?: ChatMetadata
    error?: ChatError
}

export interface InteractionMessage extends ChatMessage {
    prefix?: string
}

export interface ChatError {
    kind?: string
    name: string
    message: string

    // Rate-limit properties
    retryAfter?: string | null
    limit?: number
    userMessage?: string
    retryAfterDate?: Date
    retryAfterDateString?: string // same as retry after Date but JSON serializable
    retryMessage?: string
    feature?: string
    upgradeIsAvailable?: boolean

    // Prevent Error from being passed as ChatError.
    // Errors should be converted using errorToChatError.
    isChatErrorGuard: 'isChatErrorGuard'
}

export interface ChatMetadata {
    source?: ChatEventSource
    requestID?: string
    chatModel?: string
}

export interface UserLocalHistory {
    chat: ChatHistory
    input: ChatInputHistory[]
}

export interface ChatHistory {
    [chatID: string]: TranscriptJSON
}

/**
 * We must support bare strings in history because existing users may have histories
 * persisted with them (and since we support them, we can also use them for entries with
 * no context files).
 */
export type ChatInputHistory =
    | string
    | {
          inputText: string
          inputContextFiles: ContextFile[]
      }

export interface OldChatHistory {
    [chatID: string]: ChatMessage[]
}

export type ChatEventSource =
    | 'chat'
    | 'editor'
    | 'menu'
    | 'code-action'
    | 'custom-commands'
    | 'test'
    | 'code-lens'
    | CodyDefaultCommands
    | RecipeID

/**
 * Converts an Error to a ChatError. Note that this cannot be done naively,
 * because some of the Error object's keys are typically not enumerable, and so
 * would be omitted during serialization.
 */
export function errorToChatError(error: Error): ChatError {
    return {
        isChatErrorGuard: 'isChatErrorGuard',
        ...error,
        message: error.message,
        name: error.name,
    }
}
