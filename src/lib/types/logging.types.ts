export interface LogChannelDefinition {
  key: string; // Internal key (e.g., 'messages')
  name: string; // English channel name (e.g., 'logs-messages')
  webhookField: string; // Database field (e.g., 'messagesWebhook')
  enabledField: string; // Database field (e.g., 'messagesEnabled')
  description: string; // User-friendly description
  category: 'core' | 'advanced'; // For UI grouping
}

export interface LogSetupRequest {
  enabledTypes: string[]; // Array of log type keys to enable
  categoryName?: string; // Optional custom category name
}

export interface LogSetupResponse {
  success: boolean;
  message: string;
  categoryId?: string;
  channelsCreated: number;
  enabledTypes: string[];
  errors?: string[];
}
