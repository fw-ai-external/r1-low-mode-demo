"use server";

import { createFireworks } from "@ai-sdk/fireworks";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createAI, getMutableAIState, streamUI } from "ai/rsc";
import type { ReactNode } from "react";
import { z } from "zod";
import { wrapLanguageModel } from "ai";

export interface ServerMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClientMessage {
  role: "user" | "assistant";
  display: ReactNode;
}

export async function continueConversation(
  input: string,
  apiKeys: {
    fireworks: string;
    together?: string;
  }
): Promise<{
  lowMessage: ClientMessage;
  message: ClientMessage;
  togetherMessage: ClientMessage;
}> {
  "use server";

  const history = getMutableAIState();

  const fireworks = createFireworks({
    apiKey: apiKeys.fireworks,
  });

  const lowModeResults = await streamUI({
    model: wrapLanguageModel({
      // @ts-expect-error ai sdk types are not updated for @ai-sdk/fireworks v0.1.11
      model: fireworks("accounts/fireworks/models/deepseek-r1"),
    }),
    providerOptions: {
      // @ts-expect-error ai sdk does not support this option
      reasoning_effort: "low",
    },
    messages: [...history.get().lowMessage, { role: "user", content: input }],
    text: ({ content, done }) => {
      if (done) {
        history.done(
          (models: {
            lowMessage: ServerMessage[];
            message: ServerMessage[];
            togetherMessage: ServerMessage[];
          }) => ({
            ...models,
            lowMessage: [...models.lowMessage, { role: "assistant", content }],
          })
        );
      }

      const thinkIndex = content.indexOf("</think>");
      return (
        <div>
          <div className="mr-2 rounded-lg bg-gray-300 p-2 text-sm">
            {thinkIndex
              ? content.substring(
                  0,
                  thinkIndex > 0 ? thinkIndex + 9 : content.length
                )
              : content}
          </div>
          {thinkIndex > 0 && (
            <div className="text-sm">
              {content.substring(thinkIndex + 9, content.length)}
            </div>
          )}
        </div>
      );
    },
  });

  const stdModeResults = await streamUI({
    // @ts-expect-error ai sdk types are not updated for @ai-sdk/fireworks v0.1.11
    model: fireworks("accounts/fireworks/models/deepseek-r1"),
    messages: [...history.get().lowMessage, { role: "user", content: input }],
    text: ({ content, done }) => {
      if (done) {
        history.done(
          (models: {
            lowMessage: ServerMessage[];
            message: ServerMessage[];
            togetherMessage: ServerMessage[];
          }) => ({
            ...models,
            lowMessage: [...models.lowMessage, { role: "assistant", content }],
          })
        );
      }
      const thinkIndex = content.indexOf("</think>");
      return (
        <div>
          <div className="mr-2 rounded-lg bg-gray-300 p-2 text-sm">
            {thinkIndex
              ? content.substring(
                  0,
                  thinkIndex > 0 ? thinkIndex + 9 : content.length
                )
              : content}
          </div>
          {thinkIndex > 0 && (
            <div className="text-sm">
              {content.substring(thinkIndex + 9, content.length)}
            </div>
          )}
        </div>
      );
    },
  });

  let togetherModeResults: unknown;
  if (apiKeys.together) {
    const togetherai = createTogetherAI({
      apiKey: apiKeys.together,
    });

    togetherModeResults = await streamUI({
      // @ts-expect-error ai sdk types are not updated for @ai-sdk/togetherai SDK
      model: togetherai("deepseek-ai/DeepSeek-R1"),
      messages: [...history.get().lowMessage, { role: "user", content: input }],
      text: ({ content, done }) => {
        if (done) {
          history.done(
            (models: {
              lowMessage: ServerMessage[];
              message: ServerMessage[];
              togetherMessage: ServerMessage[];
            }) => ({
              ...models,
              lowMessage: [
                ...models.lowMessage,
                { role: "assistant", content },
              ],
            })
          );
        }

        const thinkIndex = content.indexOf("</think>");
        return (
          <div>
            <div className="mr-2 rounded-lg bg-gray-300 p-2 text-sm">
              {thinkIndex
                ? content.substring(
                    0,
                    thinkIndex > 0 ? thinkIndex + 9 : content.length
                  )
                : content}
            </div>
            {thinkIndex > 0 && (
              <div className="text-sm">
                {content.substring(thinkIndex + 9, content.length)}
              </div>
            )}
          </div>
        );
      },
    });
  }

  return {
    lowMessage: {
      role: "assistant",
      display: lowModeResults.value,
    },
    message: {
      role: "assistant",
      display: stdModeResults.value,
    },
    togetherMessage: {
      role: "assistant",
      display:
        typeof togetherModeResults === "object" &&
        togetherModeResults !== null &&
        "value" in togetherModeResults
          ? (togetherModeResults.value as ReactNode)
          : (null as unknown as ReactNode),
    },
  };
}

export async function listModels({
  fireworksAPIKey,
  togetherAPIKey,
}: {
  fireworksAPIKey: string;
  togetherAPIKey: string;
}) {
  "use server";

  const apiKeySchema = z.object({
    fireworks: z.string().min(1, "Fireworks API key is required"),
    together: z.string().optional(),
  });

  const apiKeys = apiKeySchema.parse({
    fireworks: fireworksAPIKey,
    together: togetherAPIKey,
  });

  const results = {
    fireworks: [],
    together: [],
    error: null as string | null,
  };

  try {
    // Test Fireworks API
    const fireworksResponse = await fetch(
      "https://api.fireworks.ai/inference/v1/models",
      {
        headers: {
          Authorization: `Bearer ${apiKeys.fireworks}`,
        },
      }
    );

    if (!fireworksResponse.ok) {
      throw new Error(`Fireworks API error: ${fireworksResponse.statusText}`);
    }

    results.fireworks = await fireworksResponse.json();

    // Test Together API if key exists
    if (apiKeys.together) {
      const togetherResponse = await fetch(
        "https://api.together.xyz/models/list",
        {
          headers: {
            Authorization: `Bearer ${apiKeys.together}`,
          },
        }
      );

      if (!togetherResponse.ok) {
        throw new Error(`Together API error: ${togetherResponse.statusText}`);
      }

      results.together = await togetherResponse.json();
    }

    return results;
  } catch (error) {
    results.error =
      error instanceof Error ? error.message : "Unknown error occurred";
    return results;
  }
}

export const AI = createAI<
  {
    lowMessage: ServerMessage[];
    message: ServerMessage[];
    togetherMessage: ServerMessage[];
  },
  {
    lowMessage: ClientMessage[];
    message: ClientMessage[];
    togetherMessage: ClientMessage[];
  }
>({
  actions: {
    continueConversation,
    listModels,
  },
  initialAIState: {
    lowMessage: [],
    message: [],
    togetherMessage: [],
  },
  initialUIState: {
    lowMessage: [],
    message: [],
    togetherMessage: [],
  },
});
