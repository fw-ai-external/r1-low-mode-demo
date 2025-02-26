"use client";

import { useActions, useUIState } from "ai/rsc";
import { nanoid } from "nanoid";
import type { AI } from "./actions";

import { Thread } from "@/components/ui/assistant-ui/thread";
import {
  type AppendMessage,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import { useVercelRSCRuntime } from "@assistant-ui/react-ai-sdk";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ApiKeyModal } from "@/components/api-key-modal";
export const maxDuration = 300; // This function can run for a maximum of 300 seconds

export default function Home() {
  return (
    <main className="h-dvh">
      <MyRuntimeProvider />
    </main>
  );
}

const MyRuntimeProvider = () => {
  const { continueConversation } = useActions();
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useUIState<typeof AI>();
  const [fwError, setFwError] = useState<string | null>(null);
  const [openaiError, setOpenaiError] = useState<string | null>(null);

  const onNew = async (m: AppendMessage) => {
    if (m.content[0]?.type !== "text")
      throw new Error("Only text messages are supported");
    const apiKeys = JSON.parse(localStorage.getItem("apiKeys") || "{}");

    const newMessage = {
      id: nanoid(),
      role: "user",
      display: m.content[0].text,
    } as const;

    setMessages((currentConversation) => {
      return {
        ...currentConversation,
        lowMessage: [...currentConversation.lowMessage, newMessage],
        message: [...currentConversation.message, newMessage],
        openaiMessage: [...currentConversation.openaiMessage, newMessage],
      };
    });

    try {
      setIsRunning(true);
      const { lowMessage, message, openaiMessage, fwError, openaiError } =
        await continueConversation(newMessage.display, apiKeys);

      if (fwError) {
        setFwError(fwError);
      }
      if (openaiError) {
        setOpenaiError(openaiError);
      }

      setMessages((currentConversation) => ({
        ...currentConversation,
        lowMessage: [...currentConversation.lowMessage, lowMessage],
        message: [...currentConversation.message, message],
        openaiMessage: [...currentConversation.openaiMessage, openaiMessage],
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const runtimeLow = useVercelRSCRuntime({
    messages: messages.lowMessage,
    isRunning,
    onNew,
  });
  const runtime = useVercelRSCRuntime({
    messages: messages.message,
    isRunning,
    onNew,
  });
  const runtimeOpenai = useVercelRSCRuntime({
    messages: messages.openaiMessage,
    isRunning,
    onNew,
  });
  const models = [
    {
      name: "DeepSeek R1 Low Mode (NEW)",
      model: "deepseek-r1-low-mode",
      provider: "fireworks",
    },
    { name: "DeepSeek R1", model: "deepseek-r1", provider: "fireworks" },
    {
      name: "OpenAI o3-mini",
      model: "o3-mini",
      provider: "openai",
    },
  ] as const;

  return (
    <div className="m-4 flex h-[calc(100vh-4rem)] flex-col gap-2">
      <div className="flex justify-end">
        <ApiKeyModal />
      </div>
      <div className="flex flex-1 flex-row gap-2">
        <Card className="flex h-full w-1/3 flex-col">
          <AssistantRuntimeProvider runtime={runtimeLow}>
            <div className="flex h-full flex-col">
              <div className="text-md pl-6 pt-6 text-gray-500">
                <strong>R1 Low Mode (NEW)</strong>
                {fwError && <div className="text-red-500">{fwError}</div>}
              </div>
              <Thread model={models[0]} />
            </div>
          </AssistantRuntimeProvider>
        </Card>
        <Card className="flex h-full w-1/3 flex-col">
          <AssistantRuntimeProvider runtime={runtime}>
            <div className="flex h-full flex-col">
              <div className="text-md pl-6 pt-6 text-gray-500">
                <strong>OpenAI o3-mini</strong>
              </div>
              <Thread model={models[1]} />
              {fwError && <div className="text-red-500">{fwError}</div>}
            </div>
          </AssistantRuntimeProvider>
        </Card>
        <Card className="flex h-full w-1/3 flex-col">
          <AssistantRuntimeProvider runtime={runtimeOpenai}>
            <div className="flex h-full flex-col">
              <div className="text-md pl-6 pt-6 text-gray-500">
                <strong>OpenAI o3-mini</strong>
              </div>

              <Thread model={models[2]} />
              {openaiError && <div className="text-red-500">{openaiError}</div>}
            </div>
          </AssistantRuntimeProvider>
        </Card>
      </div>
    </div>
  );
};
