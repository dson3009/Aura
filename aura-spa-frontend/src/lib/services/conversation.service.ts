import { api } from "@/lib/api";
import type { Conversation, ConversationMessage } from "@/lib/types";

export interface CreateConversationPayload {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  branchId?: string;
  subject?: string;
  initialMessage: string;
}

export const conversationService = {
  create: (payload: CreateConversationPayload) =>
    api.post<Conversation>("/conversations", payload, { skipAuth: true }),

  getConversation: (conversationId: string) =>
    api.get<Conversation>(`/conversations/public/${conversationId}`, { skipAuth: true }),

  getMessages: (conversationId: string) =>
    api.get<ConversationMessage[]>(`/conversations/public/${conversationId}/messages`, { skipAuth: true }),

  sendMessage: (conversationId: string, message: string) =>
    api.post<ConversationMessage>(`/conversations/public/${conversationId}/messages`, { message }, { skipAuth: true }),
};
