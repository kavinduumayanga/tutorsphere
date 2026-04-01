type AzureChatRole = 'system' | 'user' | 'assistant';

type AzureChatMessage = {
  role: AzureChatRole;
  content: string;
};

type AzureChatRequestOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonResponse?: boolean;
};

type AzureChatChoice = {
  message?: {
    content?: string;
  };
};

type AzureChatResponse = {
  choices?: AzureChatChoice[];
  error?: {
    message?: string;
  };
};

const normalizeEndpoint = (value: string): string => value.replace(/\/+$/, '');

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export class AzureOpenAiClient {
  async chat(
    messages: AzureChatMessage[],
    options: AzureChatRequestOptions = {}
  ): Promise<string> {
    const endpoint = normalizeEndpoint(getRequiredEnv('AZURE_OPENAI_ENDPOINT'));
    const deployment = getRequiredEnv('AZURE_OPENAI_DEPLOYMENT');
    const apiVersion = getRequiredEnv('AZURE_OPENAI_API_VERSION');
    const apiKey = getRequiredEnv('AZURE_OPENAI_API_KEY');

    const url = `${endpoint}/openai/deployments/${encodeURIComponent(
      deployment
    )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 900,
        ...(options.jsonResponse ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    const data = (await response.json().catch(() => null)) as AzureChatResponse | null;

    if (!response.ok) {
      const remoteError = data?.error?.message || response.statusText;
      throw new Error(`Azure OpenAI request failed: ${remoteError}`);
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Azure OpenAI returned an empty response.');
    }

    return content;
  }
}

export const azureOpenAiClient = new AzureOpenAiClient();
