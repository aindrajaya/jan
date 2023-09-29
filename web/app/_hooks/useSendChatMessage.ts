import {
  addNewMessageAtom,
  currentChatMessagesAtom,
  currentConversationAtom,
  currentPromptAtom,
  currentStreamingMessageAtom,
  showingTyping,
  updateMessageAtom,
} from "@/_helpers/JotaiWrapper";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DataService } from "../../shared/coreService";
import {
  MessageSenderType,
  RawMessage,
  toChatMessage,
} from "@/_models/ChatMessage";
import { executeSerial } from "@/_services/pluginService";

export default function useSendChatMessage() {
  const currentConvo = useAtomValue(currentConversationAtom);
  const updateStreamMessage = useSetAtom(currentStreamingMessageAtom);
  const addNewMessage = useSetAtom(addNewMessageAtom);
  const updateMessage = useSetAtom(updateMessageAtom);
  const chatMessagesHistory = useAtomValue(currentChatMessagesAtom);
  const [currentPrompt, setCurrentPrompt] = useAtom(currentPromptAtom);
  const [, setIsTyping] = useAtom(showingTyping);
  const sendChatMessage = async () => {
    setIsTyping(true);
    setCurrentPrompt("");
    const prompt = currentPrompt.trim();
    const newMessage: RawMessage = {
      conversation_id: parseInt(currentConvo?.id ?? "0") ?? 0,
      message: prompt,
      user: "user",
      created_at: new Date().toISOString(),
    };
    const id = await executeSerial(DataService.CREATE_MESSAGE, newMessage);
    newMessage.id = id;

    const newChatMessage = await toChatMessage(newMessage);
    addNewMessage(newChatMessage);

    const recentMessages = [...chatMessagesHistory, newChatMessage]
      .slice(-10)
      .map((message) => {
        return {
          content: message.text,
          role:
            message.messageSenderType === MessageSenderType.User
              ? "user"
              : "assistant",
        };
      });
    const response = await fetch(
      "http://localhost:8080/llama/chat_completion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Access-Control-Allow-Origi": "*",
        },
        body: JSON.stringify({
          messages: recentMessages,
          stream: true,
          model: "gpt-3.5-turbo",
          max_tokens: 500,
        }),
      }
    );
    const stream = response.body;

    const decoder = new TextDecoder("utf-8");
    const reader = stream?.getReader();
    let answer = "";

    // Cache received response
    const newResponse: RawMessage = {
      conversation_id: parseInt(currentConvo?.id ?? "0") ?? 0,
      message: answer,
      user: "assistant",
      created_at: new Date().toISOString(),
    };
    const respId = await executeSerial(DataService.CREATE_MESSAGE, newResponse);
    newResponse.id = respId;
    const responseChatMessage = await toChatMessage(newResponse);
    addNewMessage(responseChatMessage);

    while (true && reader) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("SSE stream closed");
        break;
      }
      const text = decoder.decode(value);
      const lines = text.trim().split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && !line.includes("data: [DONE]")) {
          setIsTyping(false);
          const data = JSON.parse(line.replace("data: ", ""));
          answer += data.choices[0]?.delta?.content ?? "";
          if (answer.startsWith("assistant: ")) {
            answer = answer.replace("assistant: ", "").trim();
          }
          updateStreamMessage({
            ...responseChatMessage,
            text: answer,
          });
          updateMessage(
            responseChatMessage.id,
            responseChatMessage.conversationId,
            answer
          );
        }
      }
    }
    await executeSerial(DataService.UPDATE_MESSAGE, {
      ...newResponse,
      message: answer,
      updated_at: new Date()
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d+Z$/, ""),
    });
    setIsTyping(false);
  };
  return {
    sendChatMessage,
  };
}