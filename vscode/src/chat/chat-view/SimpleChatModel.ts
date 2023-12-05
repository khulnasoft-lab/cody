import * as vscode from 'vscode'

import { ChatMessage } from '@sourcegraph/cody-shared'
import { TranscriptJSON } from '@sourcegraph/cody-shared/src/chat/transcript'
import { InteractionJSON } from '@sourcegraph/cody-shared/src/chat/transcript/interaction'
import { reformatBotMessageForChat } from '@sourcegraph/cody-shared/src/chat/viewHelpers'
import { CODY_INTRO_PROMPT } from '@sourcegraph/cody-shared/src/prompt/prompt-mixin'
import { Message } from '@sourcegraph/cody-shared/src/sourcegraph-api'

import { contextItemsToContextFiles } from './chat-helpers'

export interface MessageWithContext {
    message: Message

    // If set, this should be used as the display text for the message.
    // Do not access directly, prefer using the getDisplayText function
    // instead.
    displayText?: string

    // The additional context items attached to this message (which should not
    // duplicate any previous context items in the transcript). This should
    // only be defined on human messages.
    newContextUsed?: ContextItem[]
}

export class SimpleChatModel {
    constructor(
        public modelID: string,
        private messagesWithContext: MessageWithContext[] = [],
        public readonly sessionID: string = new Date(Date.now()).toUTCString()
    ) {}

    public isEmpty(): boolean {
        return this.messagesWithContext.length === 0
    }

    public setNewContextUsed(newContextUsed: ContextItem[]): void {
        const lastMessage = this.messagesWithContext.at(-1)
        if (!lastMessage) {
            throw new Error('no last message')
        }
        if (lastMessage.message.speaker !== 'human') {
            throw new Error('Cannot set new context used for bot message')
        }
        lastMessage.newContextUsed = newContextUsed
    }

    public addHumanMessage(message: Omit<Message, 'speaker'>): void {
        if (this.messagesWithContext.at(-1)?.message.speaker === 'human') {
            throw new Error('Cannot add a user message after a user message')
        }
        if (message.text) {
            message.text = `${CODY_INTRO_PROMPT} ${message.text}`
        }
        this.messagesWithContext.push({
            message: {
                ...message,
                speaker: 'human',
            },
        })
    }

    public addBotMessage(message: Omit<Message, 'speaker'>, displayText?: string): void {
        if (this.messagesWithContext.at(-1)?.message.speaker === 'assistant') {
            throw new Error('Cannot add a bot message after a bot message')
        }
        this.messagesWithContext.push({
            displayText,
            message: {
                ...message,
                speaker: 'assistant',
            },
        })
    }

    public getLastHumanMessages(): MessageWithContext | undefined {
        return this.messagesWithContext.findLast(message => message.message.speaker === 'human')
    }

    public updateLastHumanMessage(message: Omit<Message, 'speaker'>): void {
        const lastMessage = this.messagesWithContext.at(-1)
        if (!lastMessage) {
            return
        }
        if (lastMessage.message.speaker === 'human') {
            this.messagesWithContext.pop()
        } else if (lastMessage.message.speaker === 'assistant') {
            this.messagesWithContext.splice(-2, 2)
        }
        this.addHumanMessage(message)
    }

    public getMessagesWithContext(): MessageWithContext[] {
        return this.messagesWithContext
    }

    /**
     * Serializes to the legacy transcript JSON format
     */
    public toTranscriptJSON(): TranscriptJSON {
        const interactions: InteractionJSON[] = []
        for (let i = 0; i < this.messagesWithContext.length; i += 2) {
            const humanMessage = this.messagesWithContext[i]
            const botMessage = this.messagesWithContext[i + 1]
            if (humanMessage.message.speaker !== 'human') {
                throw new Error('SimpleChatModel.toTranscriptJSON: expected human message, got bot')
            }
            if (botMessage.message.speaker !== 'assistant') {
                throw new Error('SimpleChatModel.toTranscriptJSON: expected bot message, got human')
            }
            interactions.push({
                humanMessage: {
                    speaker: humanMessage.message.speaker,
                    text: humanMessage.message.text,
                    displayText: getDisplayText(humanMessage),
                },
                assistantMessage: {
                    speaker: botMessage.message.speaker,
                    text: botMessage.message.text,
                    displayText: getDisplayText(botMessage),
                },
                usedContextFiles: contextItemsToContextFiles(humanMessage.newContextUsed ?? []),

                // These fields are unused on deserialization
                fullContext: [],
                usedPreciseContext: [],
                timestamp: 'n/a',
            })
        }
        return {
            id: this.sessionID,
            chatModel: this.modelID,
            lastInteractionTimestamp: this.sessionID,
            interactions,
        }
    }
}

export interface ContextItem {
    uri: vscode.Uri
    range?: vscode.Range
    text: string
}

export function contextItemId(contextItem: ContextItem): string {
    return contextItem.range
        ? `${contextItem.uri.toString()}#${contextItem.range.start.line}:${contextItem.range.end.line}`
        : contextItem.uri.toString()
}

export function toViewMessage(mwc: MessageWithContext): ChatMessage {
    const displayText = getDisplayText(mwc)
    return {
        ...mwc.message,
        displayText,
        contextFiles: contextItemsToContextFiles(mwc.newContextUsed || []),
    }
}

function getDisplayText(mwc: MessageWithContext): string | undefined {
    if (mwc.displayText) {
        return mwc.displayText
    }
    if (mwc.message.speaker === 'assistant' && mwc.message.text) {
        return reformatBotMessageForChat(mwc.message.text, '')
    }
    return mwc.message.text
}
