"use server";

import { createFireworks } from "@ai-sdk/fireworks";
import { createOpenAI } from "@ai-sdk/openai";
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
    openai?: string | null;
  }
): Promise<{
  lowMessage: ClientMessage;
  message: ClientMessage;
  openaiMessage: ClientMessage;
  fwError: string | null;
  openaiError: string | null;
}> {
  "use server";

  let fwError: string | null = null;
  let openaiError: string | null = null;
  const history = getMutableAIState();

  const fireworks = createFireworks({
    apiKey: apiKeys.fireworks,
    fetch: (url, options) => {
      console.log("fetching", url, options.body);
      return fetch(url, options);
    },
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
        fireworks: {
          reasoning_effort: "low",
        },
      },
      messages: [...history.get().lowMessage, { role: "user", content: input }],

      text: ({ content, done }) => {
        if (done) {
          history.done(
            (models: {
              lowMessage: ServerMessage[];
              message: ServerMessage[];
              openaiMessage: ServerMessage[];
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
      messages: [...history.get().message, { role: "user", content: input }],

      text: ({ content, done }) => {
        if (done) {
          history.done(
            (models: {
              lowMessage: ServerMessage[];
              message: ServerMessage[];
              openaiMessage: ServerMessage[];
            }) => ({
              ...models,
              message: [...models.message, { role: "assistant", content }],
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

  let openaiResults: unknown;
  if (apiKeys.openai) {
    try {
      const openai = createOpenAI({
        apiKey: apiKeys.openai,
      });
      const startTime = Date.now();
      openaiResults = await streamUI({
        // @ts-expect-error ai sdk types are not updated for @ai-sdk/openai SDK
        model: openai("o3-mini"),
        messages: [
          ...history.get().openaiMessage,
          { role: "user", content: input },
        ],

        text: ({ content, done }) => {
          if (done) {
            history.done(
              (models: {
                lowMessage: ServerMessage[];
                message: ServerMessage[];
                openaiMessage: ServerMessage[];
              }) => ({
                ...models,
                openaiMessage: [
                  ...models.openaiMessage,
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
      openaiError = error instanceof Error ? error.message : null;
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
    openaiMessage: {
      role: "assistant",
      display:
        typeof openaiResults === "object" &&
        openaiResults !== null &&
        "value" in openaiResults
          ? (openaiResults.value as ReactNode)
          : (null as unknown as ReactNode),
    },
    fwError,
    openaiError,
  };
}

export async function listModels({
  fireworksAPIKey,
  openaiAPIKey,
}: {
  fireworksAPIKey: string;
  openaiAPIKey: string;
}) {
  "use server";

  const apiKeySchema = z.object({
    fireworks: z.string().min(1, "Fireworks API key is required"),
    openai: z.string().optional(),
  });

  const apiKeys = apiKeySchema.parse({
    fireworks: fireworksAPIKey,
    openai: openaiAPIKey,
  });

  const results = {
    fireworks: [],
    openai: [],
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

    // Test OpenAI API if key exists
    if (apiKeys.openai) {
      const openaiResponse = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKeys.openai}`,
        },
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
      }

      results.openai = await openaiResponse.json();
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
    openaiMessage: ServerMessage[];
  },
  {
    lowMessage: ClientMessage[];
    message: ClientMessage[];
    openaiMessage: ClientMessage[];
  }
>({
  actions: {
    continueConversation,
    listModels,
  },
  initialAIState: {
    lowMessage: [],
    message: [],
    openaiMessage: [],
  },
  initialUIState: {
    lowMessage: [],
    message: [],
    openaiMessage: [],
  },
});
