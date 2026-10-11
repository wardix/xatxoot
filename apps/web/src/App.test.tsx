import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'

describe('App Root Dashboard (Task 1.24)', () => {
  it('should render WhatsApp 3.5-column layout on the dashboard', () => {
    const html = renderToStaticMarkup(<App />)

    // Check presence of NavRail (Column 1)
    expect(html).toContain('data-testid="nav-rail"')

    // Check presence of ChatListPanel (Column 2)
    expect(html).toContain('data-testid="chat-list-panel"')

    // Check presence of conversation canvas or empty state (Column 3)
    expect(
      html.includes('data-testid="conversation-thread"') ||
        html.includes('data-testid="conversation-empty-state"'),
    ).toBe(true)
  })
})
