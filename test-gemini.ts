import { GeminiProvider } from './src/llm/providers/gemini.js';

const provider = new GeminiProvider();
const model = 'gemini-3.1-pro-preview';

const getWeatherTool = {
  type: 'function' as const,
  function: {
    name: 'get_weather',
    description: 'Get the current weather for a city.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City and state, for example Seattle, WA',
        },
      },
      required: ['location'],
    },
  },
};

async function main(): Promise<void> {
  const messages = [
    {
      role: 'system' as const,
      content: 'You are a helpful weather assistant. Use tools when needed.',
    },
    {
      role: 'user' as const,
      content: 'What is the weather in Seattle right now?',
    },
  ];

  const firstResponse = await provider.chat({
    model,
    messages,
    tools: [getWeatherTool],
    temperature: 0,
  });

  console.log('--- First response ---');
  console.log(firstResponse.content);
  console.log('Provider state present:', Boolean(firstResponse.providerState));

  const parsed = JSON.parse(firstResponse.content) as {
    type: 'final' | 'tool_call';
    toolName?: string;
    args?: Record<string, unknown>;
  };

  if (parsed.type !== 'tool_call' || !parsed.toolName) {
    console.log('Model answered without a native tool call.');
    return;
  }

  const toolCallId = 'manual-tool-call-1';
  const toolResult = {
    location: parsed.args?.location ?? 'Seattle, WA',
    forecast: 'Cloudy',
    temperatureF: 58,
  };

  const secondResponse = await provider.chat({
    model,
    tools: [getWeatherTool],
    providerState: firstResponse.providerState,
    temperature: 0,
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: '',
        tool_calls: [{
          id: toolCallId,
          type: 'function' as const,
          function: {
            name: parsed.toolName,
            arguments: JSON.stringify(parsed.args ?? {}),
          },
        }],
      },
      {
        role: 'tool' as const,
        tool_call_id: toolCallId,
        name: parsed.toolName,
        content: JSON.stringify(toolResult),
      },
    ],
  });

  console.log('--- Second response ---');
  console.log(secondResponse.content);
  console.log('Provider state present:', Boolean(secondResponse.providerState));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
