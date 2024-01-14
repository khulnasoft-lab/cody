import { useCallback, useEffect, useMemo, useState } from 'react'

import './App.css'

import { type ChatModelProvider, type ContextFile } from '@sourcegraph/cody-shared'
import {
    type ChatHistory,
    type ChatInputHistory,
    type ChatMessage,
} from '@sourcegraph/cody-shared/src/chat/transcript/messages'
import { type EnhancedContextContextT } from '@sourcegraph/cody-shared/src/codebase-context/context-status'
import { type CodyCommand } from '@sourcegraph/cody-shared/src/commands'
import { type Configuration } from '@sourcegraph/cody-shared/src/configuration'
import { GuardrailsPost } from '@sourcegraph/cody-shared/src/guardrails'
import { type UserAccountInfo } from '@sourcegraph/cody-ui/src/Chat'

import { type AuthMethod, type AuthStatus, type LocalEnv } from '../src/chat/protocol'
import { trailingNonAlphaNumericRegex } from '../src/commands/prompt/utils'

import { Chat } from './Chat'
import {
    EnhancedContextContext,
    EnhancedContextEnabled,
    EnhancedContextEventHandlers,
} from './Components/EnhancedContextSettings'
import { LoadingPage } from './LoadingPage'
import { type View } from './NavBar'
import { Notices } from './Notices'
import { LoginSimplified } from './OnboardingExperiment'
import { updateDisplayPathEnvInfoForWebview } from './utils/displayPathEnvInfo'
import { createWebviewTelemetryService } from './utils/telemetry'
import type { VSCodeWrapper } from './utils/VSCodeApi'

export const App: React.FunctionComponent<{ vscodeAPI: VSCodeWrapper }> = ({ vscodeAPI }) => {
    const [config, setConfig] = useState<
        (Pick<Configuration, 'debugEnable' | 'experimentalGuardrails'> & LocalEnv) | null
    >(null)
    const [view, setView] = useState<View | undefined>()
    const [messageInProgress, setMessageInProgress] = useState<ChatMessage | null>(null)
    const [messageBeingEdited, setMessageBeingEdited] = useState<boolean>(false)
    const [transcript, setTranscript] = useState<ChatMessage[]>([])

    const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
    const [userAccountInfo, setUserAccountInfo] = useState<UserAccountInfo>({
        isDotComUser: true,
        isCodyProUser: false,
    })

    const [formInput, setFormInput] = useState('')
    const [inputHistory, setInputHistory] = useState<ChatInputHistory[]>([])
    const [userHistory, setUserHistory] = useState<ChatHistory | null>(null)

    const [contextSelection, setContextSelection] = useState<ContextFile[] | null>(null)

    const [errorMessages, setErrorMessages] = useState<string[]>([])
    const [suggestions, setSuggestions] = useState<string[] | undefined>()
    const [myPrompts, setMyPrompts] = useState<
        [string, CodyCommand & { isLastInGroup?: boolean; instruction?: string }][] | null
    >(null)
    const [isTranscriptError, setIsTranscriptError] = useState<boolean>(false)

    const [chatModels, setChatModels] = useState<ChatModelProvider[]>()

    const [enhancedContextEnabled, setEnhancedContextEnabled] = useState<boolean>(true)
    const [enhancedContextStatus, setEnhancedContextStatus] = useState<EnhancedContextContextT>({
        groups: [],
    })
    const onConsentToEmbeddings = useCallback((): void => {
        vscodeAPI.postMessage({ command: 'embeddings/index' })
    }, [vscodeAPI])
    const onShouldBuildSymfIndex = useCallback((): void => {
        vscodeAPI.postMessage({ command: 'symf/index' })
    }, [vscodeAPI])

    const guardrails = useMemo(() => {
        return new GuardrailsPost((snippet: string) => {
            vscodeAPI.postMessage({
                command: 'attribution-search',
                snippet,
            })
        })
    }, [vscodeAPI])

    useEffect(
        () =>
            vscodeAPI.onMessage(message => {
                switch (message.type) {
                    case 'transcript': {
                        if (message.isMessageInProgress) {
                            const msgLength = message.messages.length - 1
                            setTranscript(message.messages.slice(0, msgLength))
                            setMessageInProgress(message.messages[msgLength])
                            setIsTranscriptError(false)
                        } else {
                            setTranscript(message.messages)
                            setMessageInProgress(null)
                        }
                        vscodeAPI.setState(message.chatID)
                        break
                    }
                    case 'config':
                        setConfig(message.config)
                        setAuthStatus(message.authStatus)
                        setUserAccountInfo({
                            isCodyProUser: !message.authStatus.userCanUpgrade,
                            // Receive this value from the extension backend to make it work
                            // with E2E tests where change the DOTCOM_URL via the env variable TESTING_DOTCOM_URL.
                            isDotComUser: message.authStatus.isDotCom,
                        })
                        setView(message.authStatus.isLoggedIn ? 'chat' : 'login')
                        updateDisplayPathEnvInfoForWebview(message.workspaceFolderUris)
                        // Get chat models
                        if (message.authStatus.isLoggedIn) {
                            vscodeAPI.postMessage({ command: 'get-chat-models' })
                        }
                        break
                    case 'history':
                        setInputHistory(message.messages?.input ?? [])
                        setUserHistory(message.messages?.chat ?? null)
                        break
                    case 'enhanced-context':
                        setEnhancedContextStatus(message.context)
                        break
                    case 'userContextFiles':
                        setContextSelection(message.context)
                        break
                    case 'errors':
                        setErrorMessages([...errorMessages, message.errors].slice(-5))
                        break
                    case 'view':
                        setView(message.messages)
                        break
                    case 'suggestions':
                        setSuggestions(message.suggestions)
                        break
                    case 'custom-prompts': {
                        let prompts: [string, CodyCommand & { isLastInGroup?: boolean; instruction?: string }][] =
                            message.prompts

                        if (!prompts) {
                            setMyPrompts(null)
                            break
                        }

                        prompts = prompts.reduce(groupPrompts, []).map(addInstructions).sort()

                        // mark last prompts as last in group before adding another group
                        const lastPrompt = prompts.at(-1)
                        if (lastPrompt) {
                            const [_, command] = lastPrompt
                            command.isLastInGroup = true
                        }

                        setMyPrompts([
                            ...prompts,
                            // add another group
                            ['reset', { prompt: '', slashCommand: '/reset', description: 'Clear the chat' }],
                        ])
                        break
                    }
                    case 'transcript-errors':
                        setIsTranscriptError(message.isTranscriptError)
                        break
                    case 'chatModels':
                        setChatModels(message.models)
                        break
                    case 'attribution':
                        if (message.attribution) {
                            guardrails.notifyAttributionSuccess(message.snippet, {
                                repositories: message.attribution.repositoryNames.map(name => {
                                    return { name }
                                }),
                                limitHit: message.attribution.limitHit,
                            })
                        }
                        if (message.error) {
                            guardrails.notifyAttributionFailure(message.snippet, new Error(message.error))
                        }
                        break
                }
            }),
        [errorMessages, view, vscodeAPI, guardrails]
    )

    useEffect(() => {
        // Notify the extension host that we are ready to receive events
        vscodeAPI.postMessage({ command: 'ready' })
    }, [vscodeAPI])

    useEffect(() => {
        if (!view) {
            vscodeAPI.postMessage({ command: 'initialized' })
        }
    }, [view, vscodeAPI])

    useEffect(() => {
        if (formInput.endsWith(' ')) {
            setContextSelection(null)
        }

        // TODO(toolmantim): Allow using @ mid-message by using cursor position not endsWith

        // Regex to check if input ends with the '@' tag format, always get the last @tag
        // pass: 'foo @bar.ts', '@bar.ts', '@foo.ts @bar', '@'
        // fail: 'foo ', '@foo.ts bar', '@ foo.ts', '@foo.ts '
        const addFileRegex = /@\S+$/
        // Get the string after the last '@' symbol
        const addFileInput = formInput.match(addFileRegex)?.[0]

        if (
            !formInput.endsWith('@') &&
            !formInput.endsWith('.') &&
            trailingNonAlphaNumericRegex.test(formInput) &&
            !contextSelection?.length
        ) {
            setContextSelection(null)
            return
        }

        if (formInput.endsWith('@') || addFileInput) {
            const query = addFileInput?.slice(1) || ''
            vscodeAPI.postMessage({ command: 'getUserContext', query })
            return
        }

        setContextSelection(null)
    }, [formInput, contextSelection?.length, vscodeAPI])

    const loginRedirect = useCallback(
        (method: AuthMethod) => {
            // We do not change the view here. We want to keep presenting the
            // login buttons until we get a token so users don't get stuck if
            // they close the browser during an auth flow.
            vscodeAPI.postMessage({ command: 'auth', type: 'simplified-onboarding', authMethod: method })
        },
        [vscodeAPI]
    )

    const telemetryService = useMemo(() => createWebviewTelemetryService(vscodeAPI), [vscodeAPI])

    if (!view || !authStatus || !config) {
        return <LoadingPage />
    }

    return (
        <div className="outer-container">
            {view === 'login' || !authStatus.isLoggedIn ? (
                <LoginSimplified
                    simplifiedLoginRedirect={loginRedirect}
                    telemetryService={telemetryService}
                    uiKindIsWeb={config?.uiKindIsWeb}
                    vscodeAPI={vscodeAPI}
                />
            ) : (
                <>
                    <Notices probablyNewInstall={!!userHistory && Object.entries(userHistory).length === 0} />
                    {errorMessages && <ErrorBanner errors={errorMessages} setErrors={setErrorMessages} />}
                    {view === 'chat' && (
                        <EnhancedContextEventHandlers.Provider
                            value={{
                                onConsentToEmbeddings,
                                onShouldBuildSymfIndex,
                                onEnabledChange: (enabled): void => {
                                    if (enabled !== enhancedContextEnabled) {
                                        setEnhancedContextEnabled(enabled)
                                    }
                                },
                            }}
                        >
                            <EnhancedContextContext.Provider value={enhancedContextStatus}>
                                <EnhancedContextEnabled.Provider value={enhancedContextEnabled}>
                                    <Chat
                                        userInfo={userAccountInfo}
                                        messageInProgress={messageInProgress}
                                        messageBeingEdited={messageBeingEdited}
                                        setMessageBeingEdited={setMessageBeingEdited}
                                        transcript={transcript}
                                        contextSelection={contextSelection}
                                        formInput={formInput}
                                        setFormInput={setFormInput}
                                        inputHistory={inputHistory}
                                        setInputHistory={setInputHistory}
                                        vscodeAPI={vscodeAPI}
                                        suggestions={suggestions}
                                        setSuggestions={setSuggestions}
                                        telemetryService={telemetryService}
                                        chatCommands={myPrompts || undefined}
                                        isTranscriptError={isTranscriptError}
                                        chatModels={chatModels}
                                        enableNewChatUI={true}
                                        setChatModels={setChatModels}
                                        welcomeMessage={getWelcomeMessageByOS(config?.os)}
                                        guardrails={config.experimentalGuardrails ? guardrails : undefined}
                                    />
                                </EnhancedContextEnabled.Provider>
                            </EnhancedContextContext.Provider>
                        </EnhancedContextEventHandlers.Provider>
                    )}
                </>
            )}
        </div>
    )
}

const ErrorBanner: React.FunctionComponent<{ errors: string[]; setErrors: (errors: string[]) => void }> = ({
    errors,
    setErrors,
}) => (
    <div className="error-container">
        {errors.map((error, i) => (
            <div key={i} className="error">
                <span>{error}</span>
                <button type="button" className="close-btn" onClick={() => setErrors(errors.filter(e => e !== error))}>
                    ×
                </button>
            </div>
        ))}
    </div>
)

/**
 * Adds `isLastInGroup` field to a prompt if represents last item in a group (e.g., default/custom/etc. prompts).
 */
function groupPrompts(
    acc: [string, CodyCommand & { isLastInGroup?: boolean }][],
    [key, command]: [string, CodyCommand],
    index: number,
    array: [string, CodyCommand][]
): [string, CodyCommand & { isLastInGroup?: boolean }][] {
    if (key === 'separator') {
        return acc
    }

    const nextItem = array[index + 1]
    if (nextItem?.[0] === 'separator') {
        acc.push([key, { ...command, isLastInGroup: true }])
        return acc
    }

    acc.push([key, command])
    return acc
}

const instructionLabels: Record<string, string> = {
    '/ask': '[question]',
    '/edit': '[instruction]',
}

/**
 * Adds `instruction` field to a prompt if it requires additional instruction.
 */
function addInstructions<T extends CodyCommand>([key, command]: [string, T]): [string, T & { instruction?: string }] {
    const instruction = instructionLabels[command.slashCommand]
    return [key, { ...command, instruction }]
}

function getWelcomeMessageByOS(os: string): string {
    const welcomeMessageMarkdown = `Welcome to Cody! Start writing code and Cody will autocomplete lines and entire functions for you.

To run [Cody Commands](command:cody.action.commands.menu) use the keyboard shortcut <span class="keyboard-shortcut"><span>${
        os === 'darwin' ? '⌥' : 'Alt'
    }</span><span>C</span></span>, the <span class="cody-icons">A</span> button, or right-click anywhere in your code.

You can start a new chat at any time with <span class="keyboard-shortcut"><span>${
        os === 'darwin' ? '⌥' : 'Alt'
    }</span><span>/</span></span> or using the <span class="cody-icons">H</span> button.

For more tips and tricks, see the [Getting Started Guide](command:cody.welcome) and [docs](https://sourcegraph.com/docs/cody).
`
    return welcomeMessageMarkdown
}
