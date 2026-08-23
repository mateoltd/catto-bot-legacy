// Research agent - handles conversation with tool execution
//
// NOTE ON API KEYS: This agent uses the user's own OpenRouter API key, which they
// provide and store in their browser's localStorage. The key is sent directly from
// the user's browser to OpenRouter's API - it never passes through any server we control.
// This is a standard pattern for client-side API integrations where users bring their own keys.

import type { ChatMessage, ToolCall, Source, AgentConfig } from './types';
import { getOpenRouterTools, executeTool, AGENT_SYSTEM_PROMPT } from './tools';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface AgentCallbacks {
  onToolStart: (toolCall: ToolCall) => void;
  onToolComplete: (toolCall: ToolCall) => void;
  onSourceAdded: (source: Source) => void;
  onReasoningStart?: () => void;
  onReasoningEnd?: () => void;
  onTextChunk?: (text: string) => void;
}

interface AgentContext {
  currentPage?: string;
  pageTitle?: string;
}

export async function runAgent(
  messages: ChatMessage[],
  config: AgentConfig,
  callbacks: AgentCallbacks,
  context?: AgentContext
): Promise<{ content: string; sources: Source[] }> {
  const allSources: Source[] = [];
  let iterations = 0;
  const maxIterations = config.maxIterations || 30;

  // Build system prompt with page context
  let systemPrompt = AGENT_SYSTEM_PROMPT;
  if (context?.currentPage) {
    const pageInfo = context.pageTitle
      ? `"${context.pageTitle}" (${context.currentPage})`
      : context.currentPage;
    systemPrompt += `\n\n## Current Page Context\nThe user is currently viewing: ${pageInfo}\nIf they ask about "this page" or reference something without specifying, they likely mean the content on this page. You can use read_doc with this path if it's a documentation page.`;
  }

  // Build conversation history for OpenRouter
  const conversationHistory: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add previous messages
  for (const msg of messages) {
    if (msg.role === 'user') {
      conversationHistory.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      conversationHistory.push({ role: 'assistant', content: msg.content });
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  while (iterations < maxIterations) {
    iterations++;

    // Signal reasoning start
    callbacks.onReasoningStart?.();

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': baseUrl || 'https://catto.dev',
      },
      body: JSON.stringify({
        model: config.model,
        messages: conversationHistory,
        tools: getOpenRouterTools(),
        tool_choice: 'auto',
        max_tokens: 4096,
      }),
    });

    // Signal reasoning end
    callbacks.onReasoningEnd?.();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No response from model');
    }

    const assistantMessage = choice.message;

    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      conversationHistory.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute each tool call
      for (const toolCallData of assistantMessage.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(toolCallData.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }

        const toolCall: ToolCall = {
          id: toolCallData.id,
          name: toolCallData.function.name,
          arguments: parsedArgs,
          status: 'executing',
        };

        callbacks.onToolStart(toolCall);

        try {
          const { result, sources } = await executeTool(toolCall, baseUrl);
          toolCall.status = 'completed';
          toolCall.result = result;

          if (sources) {
            for (const source of sources) {
              // Avoid duplicates
              if (!allSources.some(s => s.path === source.path)) {
                allSources.push(source);
                callbacks.onSourceAdded(source);
              }
            }
          }

          callbacks.onToolComplete(toolCall);

          // Add tool result to history
          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.name,
            content: result,
          });
        } catch (error) {
          toolCall.status = 'error';
          toolCall.error = error instanceof Error ? error.message : 'Tool execution failed';
          callbacks.onToolComplete(toolCall);

          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.name,
            content: `Error: ${toolCall.error}`,
          });
        }
      }

      // Continue loop to get next response
      continue;
    }

    // No tool calls - we have a final response
    if (assistantMessage.content) {
      return {
        content: assistantMessage.content,
        sources: allSources,
      };
    }

    // Empty response
    return {
      content: 'I was unable to generate a response. Please try rephrasing your question.',
      sources: allSources,
    };
  }

  // Max iterations reached - provide helpful context
  return {
    content: `I've completed ${maxIterations} research steps. Based on my findings:\n\n` +
      (allSources.length > 0
        ? `I found information in these sources:\n${allSources.map(s => `- ${s.title} (${s.path})`).join('\n')}\n\nPlease review these sources directly for the complete answer, or ask a more specific question.`
        : 'I was unable to find relevant information. Try asking a more specific question or check the documentation directly.'),
    sources: allSources,
  };
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
