import React, { useCallback, useMemo, useState } from 'react'

import classNames from 'classnames'

import {
    isDefined,
    type ChatButton,
    type ChatInputHistory,
    type ChatMessage,
    type ChatModelProvider,
    type CodyCommand,
    type ContextFile,
    type Guardrails,
} from '@sourcegraph/cody-shared'

import { type CodeBlockMeta } from './chat/CodeBlocks'
import { type FileLinkProps } from './chat/components/EnhancedContext'
import { type SymbolLinkProps } from './chat/PreciseContext'
import { Transcript } from './chat/Transcript'
import { type TranscriptItemClassNames } from './chat/TranscriptItem'

import styles from './Chat.module.css'

interface ChatProps extends ChatClassNames {
    transcript: ChatMessage[]
    messageInProgress: ChatMessage | null
    messageBeingEdited: boolean
    setMessageBeingEdited: (input: boolean) => void
    formInput: string
    setFormInput: (input: string) => void
    inputHistory: ChatInputHistory[]
    setInputHistory: (history: ChatInputHistory[]) => void
    onSubmit: (text: string, submitType: ChatSubmitType, userContextFiles?: Map<string, ContextFile>) => void
    gettingStartedComponent?: React.FunctionComponent<any>
    gettingStartedComponentProps?: any
    textAreaComponent: React.FunctionComponent<ChatUITextAreaProps>
    submitButtonComponent: React.FunctionComponent<ChatUISubmitButtonProps>
    suggestionButtonComponent?: React.FunctionComponent<ChatUISuggestionButtonProps>
    fileLinkComponent: React.FunctionComponent<FileLinkProps>
    symbolLinkComponent: React.FunctionComponent<SymbolLinkProps>
    helpMarkdown?: string
    afterMarkdown?: string
    gettingStartedButtons?: ChatButton[]
    className?: string
    EditButtonContainer?: React.FunctionComponent<EditButtonProps>
    editButtonOnSubmit?: (text: string) => void
    FeedbackButtonsContainer?: React.FunctionComponent<FeedbackButtonsProps>
    feedbackButtonsOnSubmit?: (text: string) => void
    copyButtonOnSubmit?: CodeBlockActionsProps['copyButtonOnSubmit']
    insertButtonOnSubmit?: CodeBlockActionsProps['insertButtonOnSubmit']
    suggestions?: string[]
    setSuggestions?: (suggestions: undefined | []) => void
    needsEmailVerification?: boolean
    needsEmailVerificationNotice?: React.FunctionComponent
    codyNotEnabledNotice?: React.FunctionComponent
    abortMessageInProgressComponent?: React.FunctionComponent<{ onAbortMessageInProgress: () => void }>
    onAbortMessageInProgress?: () => void
    isCodyEnabled: boolean
    ChatButtonComponent?: React.FunctionComponent<ChatButtonProps>
    chatCommands?: [string, CodyCommand][] | null
    filterChatCommands?: (chatCommands: [string, CodyCommand][], input: string) => [string, CodyCommand][]
    ChatCommandsComponent?: React.FunctionComponent<ChatCommandsProps>
    isTranscriptError?: boolean
    contextSelection?: ContextFile[] | null
    UserContextSelectorComponent?: React.FunctionComponent<UserContextSelectorProps>
    chatModels?: ChatModelProvider[]
    EnhancedContextSettings?: React.FunctionComponent<{ isOpen: boolean; setOpen: (open: boolean) => void }>
    ChatModelDropdownMenu?: React.FunctionComponent<ChatModelDropdownMenuProps>
    onCurrentChatModelChange?: (model: ChatModelProvider) => void
    userInfo: UserAccountInfo
    postMessage?: ApiPostMessage
    guardrails?: Guardrails
}

export interface UserAccountInfo {
    isDotComUser: boolean
    isCodyProUser: boolean
}

export type ApiPostMessage = (message: any) => void

interface ChatClassNames extends TranscriptItemClassNames {
    inputRowClassName?: string
    chatInputContextClassName?: string
    chatInputClassName?: string
}

export interface ChatButtonProps {
    label: string
    action: string
    onClick: (action: string) => void
    appearance?: 'primary' | 'secondary' | 'icon'
}

export interface ChatUITextAreaProps {
    className: string
    rows: number
    autoFocus: boolean
    value: string
    required: boolean
    disabled?: boolean
    onInput: React.FormEventHandler<HTMLElement>
    setValue?: (value: string) => void
    onKeyDown?: (event: React.KeyboardEvent<HTMLElement>, caretPosition: number | null) => void
    onFocus?: (event: React.FocusEvent<HTMLElement>) => void
    chatModels?: ChatModelProvider[]
}

export interface ChatUISubmitButtonProps {
    className: string
    disabled: boolean
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
    onAbortMessageInProgress?: () => void
}

export interface ChatUISuggestionButtonProps {
    suggestion: string
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export interface EditButtonProps {
    className: string
    disabled?: boolean
    messageBeingEdited: boolean
    setMessageBeingEdited: (input: boolean) => void
}

export interface FeedbackButtonsProps {
    className: string
    disabled?: boolean
    feedbackButtonsOnSubmit: (text: string) => void
}

export interface CodeBlockActionsProps {
    copyButtonOnSubmit: (text: string, event?: 'Keydown' | 'Button', metadata?: CodeBlockMeta) => void
    insertButtonOnSubmit: (text: string, newFile?: boolean, metadata?: CodeBlockMeta) => void
}

export interface ChatCommandsProps {
    setFormInput: (input: string) => void
    setSelectedChatCommand: (index: number) => void
    chatCommands?: [string, CodyCommand][] | null
    selectedChatCommand?: number
    onSubmit: (input: string, inputType: ChatSubmitType) => void
}

export interface UserContextSelectorProps {
    onSelected: (context: ContextFile, input: string) => void
    formInput: string
    contextSelection?: ContextFile[]
    selected?: number
    onSubmit: (input: string, inputType: 'user') => void
    setSelectedChatContext: (arg: number) => void
}

export type ChatSubmitType = 'user' | 'suggestion' | 'example'

export interface ChatModelDropdownMenuProps {
    models: ChatModelProvider[]
    disabled: boolean // Disabled when transcript length > 1
    onCurrentChatModelChange: (model: ChatModelProvider) => void
    userInfo: UserAccountInfo
}

/**
 * The Cody chat interface, with a transcript of all messages and a message form.
 */
export const Chat: React.FunctionComponent<ChatProps> = ({
    messageInProgress,
    messageBeingEdited,
    setMessageBeingEdited,
    transcript,
    formInput,
    setFormInput,
    inputHistory,
    setInputHistory,
    onSubmit,
    textAreaComponent: TextArea,
    submitButtonComponent: SubmitButton,
    suggestionButtonComponent: SuggestionButton,
    fileLinkComponent,
    symbolLinkComponent,
    helpMarkdown,
    afterMarkdown,
    gettingStartedButtons,
    className,
    codeBlocksCopyButtonClassName,
    codeBlocksInsertButtonClassName,
    transcriptItemClassName,
    humanTranscriptItemClassName,
    transcriptItemParticipantClassName,
    transcriptActionClassName,
    inputRowClassName,
    chatInputContextClassName,
    chatInputClassName,
    EditButtonContainer,
    editButtonOnSubmit,
    FeedbackButtonsContainer,
    feedbackButtonsOnSubmit,
    copyButtonOnSubmit,
    insertButtonOnSubmit,
    suggestions,
    setSuggestions,
    needsEmailVerification = false,
    codyNotEnabledNotice: CodyNotEnabledNotice,
    needsEmailVerificationNotice: NeedsEmailVerificationNotice,
    gettingStartedComponent: GettingStartedComponent,
    gettingStartedComponentProps = {},
    abortMessageInProgressComponent: AbortMessageInProgressButton,
    onAbortMessageInProgress = () => {},
    isCodyEnabled,
    ChatButtonComponent,
    chatCommands,
    filterChatCommands,
    ChatCommandsComponent,
    isTranscriptError,
    UserContextSelectorComponent,
    contextSelection,
    chatModels,
    ChatModelDropdownMenu,
    EnhancedContextSettings,
    onCurrentChatModelChange,
    userInfo,
    postMessage,
    guardrails,
}) => {
    const [inputRows, setInputRows] = useState(1)
    const [displayCommands, setDisplayCommands] = useState<[string, CodyCommand & { instruction?: string }][] | null>(
        chatCommands || null
    )
    const [selectedChatCommand, setSelectedChatCommand] = useState(-1)
    const [historyIndex, setHistoryIndex] = useState(inputHistory.length)

    // The context files added via the chat input by user
    const [chatContextFiles, setChatContextFiles] = useState<Map<string, ContextFile>>(new Map([]))
    const [selectedChatContext, setSelectedChatContext] = useState(0)

    // Gets the display text for a context file to be completed into the chat when a user
    // selects a file.
    //
    // This is also used to reconstruct the map from the chat history (which only stores context
    // files).
    function getContextFileDisplayText(contextFile: ContextFile): string {
        const isFileType = contextFile.type === 'file'
        const range = contextFile.range ? `:${contextFile.range?.start.line}-${contextFile.range?.end.line}` : ''
        const symbolName = isFileType ? '' : `#${contextFile.fileName}`
        return `@${contextFile.path?.relative}${range}${symbolName}`
    }

    /**
     * Callback function called when a chat context file is selected from the context selector.
     *
     * Updates the chat input with the selected file context.
     *
     * Trims any existing @file text from the input.
     * Adds the selected file path and range to the input.
     * Updates contextConfig with the new added context file.
     *
     * This allows the user to quickly insert file context into the chat input.
     */
    const onChatContextSelected = useCallback(
        (selected: ContextFile, input: string): void => {
            const lastAtIndex = input.lastIndexOf('@')
            if (lastAtIndex >= 0 && selected) {
                // Trim the @file portion from input
                const inputPrefix = input.slice(0, lastAtIndex)
                const fileDisplayText = getContextFileDisplayText(selected)
                // Add empty space at the end to end the file matching process
                const newInput = `${inputPrefix}${fileDisplayText} `

                // we will use the newInput as key to check if the file still exists in formInput on submit
                setChatContextFiles(new Map(chatContextFiles).set(fileDisplayText, selected))
                setSelectedChatContext(0)
                setFormInput(newInput)
            }
        },
        [chatContextFiles, setFormInput]
    )
    // Handles selecting a chat command when the user types a slash in the chat input.
    const chatCommentSelectionHandler = useCallback(
        (inputValue: string): void => {
            if (!chatCommands?.length || !ChatCommandsComponent) {
                return
            }
            if (inputValue === '/') {
                setDisplayCommands(chatCommands)
                setSelectedChatCommand(0)
                return
            }
            if (inputValue.startsWith('/')) {
                const splittedValue = inputValue.split(' ')
                if (splittedValue.length > 1) {
                    const matchedCommand = chatCommands.filter(([name]) => name === splittedValue[0])
                    if (matchedCommand.length === 1) {
                        setDisplayCommands(matchedCommand)
                        setSelectedChatCommand(0)
                    }
                    return
                }
                const filteredCommands = filterChatCommands
                    ? filterChatCommands(chatCommands, inputValue)
                    : chatCommands.filter(command => command[1].slashCommand?.startsWith(inputValue))
                setDisplayCommands(filteredCommands)
                setSelectedChatCommand(0)
                return
            }
            setDisplayCommands(null)
            setSelectedChatCommand(-1)
        },
        [ChatCommandsComponent, chatCommands, filterChatCommands]
    )

    const inputHandler = useCallback(
        (inputValue: string): void => {
            if (contextSelection && inputValue) {
                setSelectedChatContext(0)
            }
            chatCommentSelectionHandler(inputValue)
            const rowsCount = (inputValue.match(/\n/g)?.length || 0) + 1
            setInputRows(rowsCount > 25 ? 25 : rowsCount)
            setFormInput(inputValue)
            const lastInput = inputHistory[historyIndex]
            const lastText = typeof lastInput === 'string' ? lastInput : lastInput?.inputText
            if (inputValue !== lastText) {
                setHistoryIndex(inputHistory.length)
            }
        },
        [contextSelection, chatCommentSelectionHandler, setFormInput, inputHistory, historyIndex]
    )

    const submitInput = useCallback(
        (input: string, submitType: ChatSubmitType): void => {
            if (messageInProgress) {
                return
            }
            onSubmit(input, submitType, chatContextFiles)

            // Record the chat history with (optional) context files.
            const newHistory: ChatInputHistory = chatContextFiles.size
                ? {
                      inputText: input,
                      inputContextFiles: Array.from(chatContextFiles.values()),
                  }
                : input
            setHistoryIndex(inputHistory.length + 1)
            setInputHistory([...inputHistory, newHistory])

            setSuggestions?.(undefined)
            setChatContextFiles(new Map())
            setSelectedChatContext(0)
            setDisplayCommands(null)
            setSelectedChatCommand(-1)
        },
        [messageInProgress, onSubmit, chatContextFiles, setSuggestions, inputHistory, setInputHistory]
    )
    const onChatInput = useCallback(
        ({ target }: React.SyntheticEvent) => {
            const { value } = target as HTMLInputElement
            inputHandler(value)
        },
        [inputHandler]
    )

    const onChatSubmit = useCallback((): void => {
        // Submit chat only when input is not empty and not in progress
        if (formInput.trim() && !messageInProgress) {
            setInputRows(1)
            submitInput(formInput, 'user')
            setFormInput('')
        }
    }, [formInput, messageInProgress, setFormInput, submitInput])

    const onChatKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>, caretPosition: number | null): void => {
            // Ignore alt + c key combination for editor to avoid conflict with cody shortcut
            if (event.altKey && event.key === 'c') {
                event.preventDefault()
                event.stopPropagation()
                return
            }

            // Clear & reset session on CMD+K
            if (event.metaKey && event.key === 'k') {
                onSubmit('/r', 'user', chatContextFiles)
                return
            }

            // Allows backspace and delete keystrokes to remove characters
            const deleteKeysList = new Set(['Backspace', 'Delete'])
            if (deleteKeysList.has(event.key)) {
                setSelectedChatCommand(-1)
                setSelectedChatContext(0)
                return
            }

            // Handles keyboard shortcuts with Ctrl key.
            // Checks if the Ctrl key is pressed with a key not in the allow list
            // to avoid triggering default browser shortcuts and bubbling the event.
            const ctrlKeysAllowList = new Set(['a', 'c', 'v', 'x', 'y', 'z'])
            if (event.ctrlKey && !ctrlKeysAllowList.has(event.key)) {
                event.preventDefault()
                return
            }

            // Ignore alt + c key combination for editor to avoid conflict with cody shortcut
            const vscodeCodyShortcuts = new Set(['Slash', 'KeyC'])
            if (event.altKey && vscodeCodyShortcuts.has(event.code)) {
                event.preventDefault()
                return
            }

            // Handles cycling through chat command suggestions using the up and down arrow keys
            if (displayCommands && formInput.startsWith('/')) {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    const commandsLength = displayCommands?.length
                    const curIndex = event.key === 'ArrowUp' ? selectedChatCommand - 1 : selectedChatCommand + 1
                    const newIndex = curIndex < 0 ? commandsLength - 1 : curIndex > commandsLength - 1 ? 0 : curIndex
                    setSelectedChatCommand(newIndex)
                    const newInput = displayCommands?.[newIndex]?.[1]?.slashCommand
                    setFormInput(newInput || formInput)
                    return
                }
                // close the chat command suggestions on escape key
                if (event.key === 'Escape') {
                    setDisplayCommands(null)
                    setSelectedChatCommand(-1)
                    setFormInput('')
                    return
                }
                // tab/enter to complete
                if ((event.key === 'Tab' || event.key === 'Enter') && displayCommands.length) {
                    event.preventDefault()
                    const selectedCommand = displayCommands?.[selectedChatCommand]?.[1]
                    if (formInput.startsWith(selectedCommand?.slashCommand)) {
                        // submit message if the input has slash command already completed
                        setMessageBeingEdited(false)
                        onChatSubmit()
                    } else {
                        const newInput = selectedCommand?.slashCommand
                        setFormInput(newInput || formInput)
                        setDisplayCommands(null)
                        setSelectedChatCommand(-1)
                    }
                }
                return
            }

            // Handles cycling through context matches on key presses
            if (contextSelection?.length && !formInput.endsWith(' ')) {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    const selectionLength = contextSelection?.length - 1
                    const newIndex = event.key === 'ArrowUp' ? selectedChatContext - 1 : selectedChatContext + 1
                    const newMatchIndex = newIndex < 0 ? selectionLength : newIndex > selectionLength ? 0 : newIndex
                    setSelectedChatContext(newMatchIndex)
                    return
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    const lastAtIndex = formInput.lastIndexOf('@')
                    if (lastAtIndex >= 0) {
                        const inputWithoutFileInput = formInput.slice(0, lastAtIndex)
                        // Remove @ from input
                        setFormInput(inputWithoutFileInput)
                    }
                    setSelectedChatContext(0)
                    return
                }
                // tab/enter to complete
                if (event.key === 'Tab' || event.key === 'Enter') {
                    event.preventDefault()
                    const selected = contextSelection[selectedChatContext]
                    onChatContextSelected(selected, formInput)
                    return
                }
            }

            // Submit input on Enter press (without shift) and
            // trim the formInput to make sure input value is not empty.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && formInput?.trim()) {
                event.preventDefault()
                setMessageBeingEdited(false)
                onChatSubmit()
                return
            }

            // Loop through input history on up arrow press
            if (!inputHistory?.length) {
                return
            }

            // If there's no input or the input matches the current history index, handle cycling through
            // history with the cursor keys.
            const previousHistoryInput = inputHistory[historyIndex]
            const previousHistoryText: string =
                typeof previousHistoryInput === 'string' ? previousHistoryInput : previousHistoryInput?.inputText
            if (formInput === previousHistoryText || !formInput) {
                let newIndex: number | undefined
                if (event.key === 'ArrowUp' && caretPosition === 0) {
                    newIndex = historyIndex - 1 < 0 ? inputHistory.length - 1 : historyIndex - 1
                } else if (event.key === 'ArrowDown' && caretPosition === formInput.length) {
                    if (historyIndex + 1 < inputHistory.length) {
                        newIndex = historyIndex + 1
                    }
                }
                if (newIndex !== undefined) {
                    setHistoryIndex(newIndex)

                    const newHistoryInput = inputHistory[newIndex]
                    if (typeof newHistoryInput === 'string') {
                        setFormInput(newHistoryInput)
                        setChatContextFiles(new Map())
                    } else {
                        setFormInput(newHistoryInput.inputText)
                        // chatContextFiles uses a map but history only stores a simple array.
                        const contextFilesMap = new Map<string, ContextFile>()
                        newHistoryInput.inputContextFiles.forEach(file =>
                            contextFilesMap.set(getContextFileDisplayText(file), file)
                        )
                        setChatContextFiles(contextFilesMap)
                    }
                }
            }
        },
        [
            displayCommands,
            formInput,
            contextSelection,
            inputHistory,
            historyIndex,
            onSubmit,
            chatContextFiles,
            selectedChatCommand,
            setFormInput,
            setMessageBeingEdited,
            onChatSubmit,
            selectedChatContext,
            onChatContextSelected,
        ]
    )

    const transcriptWithWelcome = useMemo<ChatMessage[]>(
        () => [
            {
                speaker: 'assistant',
                displayText: welcomeText({ helpMarkdown, afterMarkdown }),
                buttons: gettingStartedButtons,
                data: 'welcome-text',
            },
            ...transcript,
        ],
        [helpMarkdown, afterMarkdown, gettingStartedButtons, transcript]
    )

    const isGettingStartedComponentVisible = transcript.length === 0 && GettingStartedComponent !== undefined

    const [isEnhancedContextOpen, setIsEnhancedContextOpen] = useState(false)

    return (
        <div className={classNames(className, styles.innerContainer)}>
            {!isCodyEnabled && CodyNotEnabledNotice ? (
                <div className="flex-1">
                    <CodyNotEnabledNotice />
                </div>
            ) : needsEmailVerification && NeedsEmailVerificationNotice ? (
                <div className="flex-1">
                    <NeedsEmailVerificationNotice />
                </div>
            ) : (
                <Transcript
                    transcript={transcriptWithWelcome}
                    messageInProgress={messageInProgress}
                    messageBeingEdited={messageBeingEdited}
                    setMessageBeingEdited={setMessageBeingEdited}
                    fileLinkComponent={fileLinkComponent}
                    symbolLinkComponent={symbolLinkComponent}
                    codeBlocksCopyButtonClassName={codeBlocksCopyButtonClassName}
                    codeBlocksInsertButtonClassName={codeBlocksInsertButtonClassName}
                    transcriptItemClassName={transcriptItemClassName}
                    humanTranscriptItemClassName={humanTranscriptItemClassName}
                    transcriptItemParticipantClassName={transcriptItemParticipantClassName}
                    transcriptActionClassName={transcriptActionClassName}
                    className={isGettingStartedComponentVisible ? undefined : styles.transcriptContainer}
                    textAreaComponent={TextArea}
                    EditButtonContainer={EditButtonContainer}
                    editButtonOnSubmit={editButtonOnSubmit}
                    FeedbackButtonsContainer={FeedbackButtonsContainer}
                    feedbackButtonsOnSubmit={feedbackButtonsOnSubmit}
                    copyButtonOnSubmit={copyButtonOnSubmit}
                    insertButtonOnSubmit={insertButtonOnSubmit}
                    submitButtonComponent={SubmitButton}
                    chatInputClassName={chatInputClassName}
                    ChatButtonComponent={ChatButtonComponent}
                    isTranscriptError={isTranscriptError}
                    chatModels={chatModels}
                    onCurrentChatModelChange={onCurrentChatModelChange}
                    ChatModelDropdownMenu={ChatModelDropdownMenu}
                    userInfo={userInfo}
                    postMessage={postMessage}
                    guardrails={guardrails}
                />
            )}

            {isGettingStartedComponentVisible && (
                <GettingStartedComponent {...gettingStartedComponentProps} submitInput={submitInput} />
            )}

            <form className={classNames(styles.inputRow, inputRowClassName)}>
                {!displayCommands &&
                !contextSelection &&
                suggestions !== undefined &&
                suggestions.length !== 0 &&
                SuggestionButton ? (
                    <div className={styles.suggestions}>
                        {suggestions.map((suggestion: string) =>
                            suggestion.trim().length > 0 ? (
                                <SuggestionButton
                                    key={suggestion}
                                    suggestion={suggestion}
                                    onClick={() => submitInput(suggestion, 'suggestion')}
                                />
                            ) : null
                        )}
                    </div>
                ) : null}
                {messageInProgress && AbortMessageInProgressButton && (
                    <div className={classNames(styles.abortButtonContainer)}>
                        <AbortMessageInProgressButton onAbortMessageInProgress={onAbortMessageInProgress} />
                    </div>
                )}
                <div className={styles.textAreaContainer}>
                    {displayCommands && ChatCommandsComponent && formInput.startsWith('/') && (
                        <ChatCommandsComponent
                            chatCommands={displayCommands}
                            selectedChatCommand={selectedChatCommand}
                            setFormInput={setFormInput}
                            setSelectedChatCommand={setSelectedChatCommand}
                            onSubmit={onSubmit}
                        />
                    )}
                    {contextSelection && UserContextSelectorComponent && formInput && (
                        <UserContextSelectorComponent
                            selected={selectedChatContext}
                            onSelected={onChatContextSelected}
                            contextSelection={contextSelection}
                            formInput={formInput}
                            onSubmit={onSubmit}
                            setSelectedChatContext={setSelectedChatContext}
                        />
                    )}
                    <div className={styles.chatInputContainer}>
                        <TextArea
                            className={classNames(styles.chatInput, chatInputClassName)}
                            rows={inputRows}
                            value={isCodyEnabled ? formInput : 'Cody is disabled on this instance'}
                            autoFocus={true}
                            required={true}
                            disabled={needsEmailVerification || !isCodyEnabled}
                            onInput={onChatInput}
                            onFocus={() => setIsEnhancedContextOpen(false)}
                            onKeyDown={onChatKeyDown}
                            setValue={inputHandler}
                            chatModels={chatModels}
                        />
                        {EnhancedContextSettings && (
                            <div className={styles.contextButton}>
                                <EnhancedContextSettings
                                    isOpen={isEnhancedContextOpen}
                                    setOpen={setIsEnhancedContextOpen}
                                />
                            </div>
                        )}
                    </div>
                    <SubmitButton
                        className={styles.submitButton}
                        onClick={onChatSubmit}
                        disabled={needsEmailVerification || !isCodyEnabled || (!formInput.length && !messageInProgress)}
                        onAbortMessageInProgress={
                            !AbortMessageInProgressButton && messageInProgress ? onAbortMessageInProgress : undefined
                        }
                    />
                </div>
            </form>
        </div>
    )
}

interface WelcomeTextOptions {
    /** Provide users with a way to quickly access Cody docs/help.*/
    helpMarkdown?: string
    /** Provide additional content to supplement the original message. Example: tips, privacy policy. */
    afterMarkdown?: string
}

function welcomeText({
    helpMarkdown = 'See [Cody documentation](https://sourcegraph.com/docs/cody) for help and tips.',
    afterMarkdown,
}: WelcomeTextOptions): string {
    return [helpMarkdown, afterMarkdown].filter(isDefined).join('\n\n')
}
