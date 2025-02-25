"use server";
export const maxDuration = 300; // This function can run for a maximum of 300 seconds

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
    together?: string | null;
  }
): Promise<{
  lowMessage: ClientMessage;
  message: ClientMessage;
  togetherMessage: ClientMessage;
  fwError: string | null;
  togetherError: string | null;
}> {
  "use server";

  let fwError: string | null = null;
  let togetherError: string | null = null;
  const history = getMutableAIState();

  const fireworks = createFireworks({
    apiKey: apiKeys.fireworks,
  });

  let lowModeResults: Awaited<ReturnType<typeof streamUI>> | null = null;
  let stdModeResults: Awaited<ReturnType<typeof streamUI>> | null = null;
  try {
    const lowModeStartTime = Date.now();
    lowModeResults = await streamUI({
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
            <div className="absolute -bottom-8 left-11 flex items-center gap-3 self-end">
              <p className="mx-auto w-full max-w-screen-md p-2 text-right text-xs text-[#b8b5a9]">
                Generation Time: {Date.now() - lowModeStartTime}ms
              </p>
            </div>
          </div>
        );
      },
    });

    const startTime = Date.now();
    stdModeResults = await streamUI({
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
            <div className="absolute -bottom-8 left-11 flex items-center gap-3 self-end">
              <div className="flex items-center gap-1">
                <p className="mx-auto w-full max-w-screen-md p-2 text-right text-xs text-[#b8b5a9]">
                  Generation Time: {Date.now() - startTime}ms
                </p>
              </div>
            </div>
          </div>
        );
      },
    });
  } catch (error) {
    fwError = error instanceof Error ? error.message : null;
  }

  let togetherModeResults: unknown;
  if (apiKeys.together) {
    try {
      const togetherai = createTogetherAI({
        apiKey: apiKeys.together,
      });
      const startTime = Date.now();
      togetherModeResults = await streamUI({
        // @ts-expect-error ai sdk types are not updated for @ai-sdk/togetherai SDK
        model: togetherai("deepseek-ai/DeepSeek-R1"),
        messages: [
          ...history.get().lowMessage,
          { role: "user", content: input },
        ],

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
                  {
                    role: "assistant",
                    content,
                  },
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
              <div className="absolute -bottom-8 left-11 flex items-center gap-3 self-end">
                <p className="mx-auto w-full max-w-screen-md p-2 text-right text-xs text-[#b8b5a9]">
                  Generation Time: {Date.now() - startTime}ms
                </p>
              </div>
            </div>
          );
        },
      });
    } catch (error) {
      console.error(error);
      togetherError = error instanceof Error ? error.message : null;
    }
  }

  return {
    lowMessage: {
      role: "assistant",
      display: lowModeResults ? lowModeResults.value : null,
    },
    message: {
      role: "assistant",
      display: stdModeResults ? stdModeResults.value : null,
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
    fwError,
    togetherError,
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
        "https://api.together.xyz/v1/models",
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
