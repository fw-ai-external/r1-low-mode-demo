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
        togetherMessage: [...currentConversation.togetherMessage, newMessage],
      };
    });

    try {
      setIsRunning(true);
      const { lowMessage, message, togetherMessage } =
        await continueConversation(newMessage.display, apiKeys);
      setMessages((currentConversation) => ({
        ...currentConversation,
        lowMessage: [...currentConversation.lowMessage, lowMessage],
        message: [...currentConversation.message, message],
        togetherMessage: [
          ...currentConversation.togetherMessage,
          togetherMessage,
        ],
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
  const runtimeTogether = useVercelRSCRuntime({
    messages: messages.togetherMessage,
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
      name: "DeepSeek R1 on Together AI",
      model: "deepseek-r1-together-ai",
      provider: "together",
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
                <strong>DeepSeek R1 Low Mode (NEW)</strong>
              </div>
              <Thread model={models[0]} />
            </div>
          </AssistantRuntimeProvider>
        </Card>
        <Card className="flex h-full w-1/3 flex-col">
          <AssistantRuntimeProvider runtime={runtime}>
            <div className="flex h-full flex-col">
              <div className="text-md pl-6 pt-6 text-gray-500">
                <strong>DeepSeek R1</strong>
              </div>
              <Thread model={models[1]} />
            </div>
          </AssistantRuntimeProvider>
        </Card>
        <Card className="flex h-full w-1/3 flex-col">
          <AssistantRuntimeProvider runtime={runtimeTogether}>
            <div className="flex h-full flex-col">
              <div className="text-md pl-6 pt-6 text-gray-500">
                <strong>DeepSeek R1 on Together AI</strong>
              </div>
              <Thread model={models[2]} />
            </div>
          </AssistantRuntimeProvider>
        </Card>
      </div>
    </div>
  );
};
