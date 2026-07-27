// The live model call — spec 23 §5.2. SERVER ONLY.
//
// This is the only file in the engine that imports the SDK, and only the
// extraction API route imports this file. Everything else — the packet, the six
// checks, the run record — is a pure function beside it, which is what makes
// the whole layer testable with no network (§14.3 step 4).
//
// Claude Opus 5's rules come with the model and are 400 errors, not preferences:
// no temperature / top_p / top_k, no budget_tokens (thinking is on by default,
// depth set by `output_config.effort`), no assistant-turn prefill, and
// max_tokens caps thinking PLUS output — hence the generous 16000.

import Anthropic from '@anthropic-ai/sdk';
import type { CreateMessage, ModelRequest, ModelResponse } from './extraction';
import type { RunUsage } from './runs';

export function sdkCaller(apiKey: string): CreateMessage {
  const client = new Anthropic({ apiKey });
  return async (req: ModelRequest): Promise<ModelResponse> => {
    // The SDK's published types lag `output_config` and `fallbacks`; the wire
    // shape is what the API takes, so the params go through as declared.
    const raw = await (client.beta.messages.create as unknown as
      (p: unknown) => Promise<unknown>)({
        model: req.model,
        max_tokens: req.max_tokens,
        output_config: req.output_config,
        system: req.system,
        messages: req.messages,
        betas: req.betas,
        fallbacks: req.fallbacks,
      });

    const r = raw as {
      stop_reason?: string;
      stop_details?: { category?: string | null; explanation?: string | null } | null;
      content?: { type: string; text?: string }[];
      usage?: Partial<RunUsage>;
    };
    // stop_reason is read by the caller BEFORE this text is trusted (§5.2).
    const text = (r.content ?? []).find(b => b.type === 'text')?.text ?? '';
    return {
      stop_reason: r.stop_reason ?? 'end_turn',
      stop_details: r.stop_details ?? null,
      text,
      usage: {
        input_tokens: r.usage?.input_tokens ?? 0,
        cache_read_input_tokens: r.usage?.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: r.usage?.cache_creation_input_tokens ?? 0,
        output_tokens: r.usage?.output_tokens ?? 0,
      },
    };
  };
}
