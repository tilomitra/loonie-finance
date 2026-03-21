# AI Advisor — Design Spec

## Overview

Add a dedicated AI Advisor chat page to Loonie Finance, powered by OpenAI's GPT-4o with web search. Users provide their OpenAI API key in Settings. The AI has full access to the user's financial context (accounts, balances, income, province, contribution room) and can answer personalized Canadian personal finance questions with real-time web data.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interaction model | Dedicated chat page | Simpler than floating widget; finance conversations are multi-turn and detailed |
| Financial context | Full automatic access | All data is local; user already trusts OpenAI with their API key |
| Model | GPT-4o with web search | Web search critical for current rates, tax rules, prices |
| Chat history | Single session (no persistence) | Dramatically simpler; no storage schema for chat; AI has context each time anyway |

## Architecture

### New Files

- `src/pages/Advisor.tsx` — Main chat page component. Manages message state (array of `{role, content}` in React state). Renders context banner, message list, and input area. Handles streaming API calls.
- `src/components/advisor/ChatMessage.tsx` — Renders a single message bubble (user or assistant). Supports markdown rendering for AI responses. Shows web search citations when present.
- `src/components/advisor/ChatInput.tsx` — Text input with send button. Handles Enter-to-submit, disabled state while streaming.
- `src/hooks/useFinancialContext.ts` — Hook that reads all Dexie data (accounts, balances, userProfile, net worth) and assembles it into a structured system prompt string.
- `src/lib/openai.ts` — Thin wrapper around `fetch` to OpenAI's `/v1/chat/completions` endpoint. Handles streaming response parsing (SSE). No SDK dependency.

### Modified Files

- `src/types/index.ts` — Add `openaiApiKey?: string` to `UserProfile` interface.
- `src/pages/Settings.tsx` — Add "AI Integration" section with a password-type input for the OpenAI API key. Stored on the `userProfile` singleton in Dexie.
- `src/components/layout/Sidebar.tsx` — Add "AI Advisor" nav item with a lucide icon (e.g., `BotMessageSquare`).
- `src/App.tsx` — Add `/advisor` route pointing to the Advisor page.

### No New Dependencies

The OpenAI Chat Completions API is called via `fetch` with streaming (SSE parsing). This avoids adding the `openai` npm package and keeps the bundle small. For markdown rendering in AI responses, use a lightweight approach (either a small library like `marked` or simple HTML rendering of common patterns).

## Data Flow

```
User types question
        │
        ▼
Advisor.tsx appends {role:"user", content} to messages state
        │
        ▼
useFinancialContext() builds system prompt from Dexie data:
  - User profile (income, province, DOB, CPP years)
  - All accounts with balances and types
  - Net worth (total assets, total debts)
  - Contribution room (TFSA, RRSP, FHSA)
        │
        ▼
openai.ts sends POST to https://api.openai.com/v1/chat/completions
  - model: "gpt-4o"
  - messages: [system prompt, ...conversation history]
  - tools: [{ type: "web_search_preview" }]
  - stream: true
  - Authorization: Bearer <key from Dexie>
        │
        ▼
SSE stream parsed token-by-token → assistant message updated in React state
        │
        ▼
ChatMessage renders streaming text with markdown formatting
  - Web search citations shown at bottom when present
```

## System Prompt Design

The system prompt instructs the AI on its role and injects the user's financial context:

```
You are a knowledgeable Canadian personal finance advisor embedded in Loonie Finance,
a personal finance app. You have access to the user's real financial data shown below.

Give specific, actionable advice based on their actual numbers. When relevant, cite
current Canadian tax rules, contribution limits, and rates. Use web search for
current interest rates, market data, or recent policy changes.

Always note that you are not a licensed financial advisor and your advice is
for informational purposes.

=== USER FINANCIAL PROFILE ===
Province: {province}
Annual Income: {income}
Date of Birth: {dob}
Years Contributed to CPP: {cppYears}

=== ACCOUNTS ===
{formatted list of accounts with types and balances}

=== NET WORTH ===
Total Assets: {totalAssets}
Total Debts: {totalDebts}
Net Worth: {netWorth}

=== CONTRIBUTION ROOM ===
TFSA Cumulative Contributions: {tfsa} (Lifetime max: $109,000)
RRSP Cumulative Contributions: {rrsp}
FHSA Cumulative Contributions: {fhsa} (Lifetime max: $40,000)
```

## UI Design

### Chat Page Layout

- **Header:** "AI Advisor" title with subtitle "Powered by GPT-4o · Web search enabled". "New Chat" button to clear conversation.
- **Context banner:** Yellow-tinted bar below header showing summary of loaded financial context (account count, net worth, income, province, key contribution room). Makes it transparent what the AI can see.
- **Message area:** Scrollable container. User messages right-aligned (primary blue background). Assistant messages left-aligned (surface background with border). Auto-scrolls to bottom on new messages.
- **Input area:** Fixed to bottom. Text input with placeholder "Ask about your finances..." and a send button. Disabled while AI is streaming. Enter to send, Shift+Enter for newline.
- **Empty state:** When no messages, show suggested questions: "Should I prioritize TFSA or RRSP?", "How much CPP will I receive at 65?", "What's my effective tax rate?", "Am I on track for FIRE?"

### Settings Page Addition

New "AI Integration" section below the existing "Registered Accounts" section:
- OpenAI API Key: password input with show/hide toggle
- Helper text: "Your API key is stored locally and sent directly to OpenAI. Get one at platform.openai.com"

### Advisor Page Without API Key

If no API key is set, show a friendly message directing the user to Settings to add their key, with a direct link.

## Error Handling

- **No API key:** Show setup prompt with link to Settings.
- **Invalid API key (401):** Show inline error "Invalid API key. Check your key in Settings."
- **Rate limit (429):** Show "Rate limited. Please wait a moment and try again."
- **Network error:** Show "Could not reach OpenAI. Check your internet connection."
- **Stream interruption:** Show partial response with an error note appended.

## Testing

- `useFinancialContext` hook: Unit test that it correctly assembles context from mock Dexie data.
- `openai.ts`: Unit test SSE parsing logic with mock streams.
- Component tests are optional for v1 given the straightforward UI.

## Out of Scope (v2 candidates)

- Persistent chat history
- Model selector (gpt-4o-mini, etc.)
- Floating chat widget on other pages
- File/image upload
- Function calling to modify accounts
- Cost tracking / token usage display
