import axios, { type AxiosInstance } from 'axios';

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000';

/**
 * Create an axios instance configured for the bot API
 */
export const botApi: AxiosInstance = axios.create({
  baseURL: BOT_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Client-side API helper with cookie forwarding
 */
export const api = {
  /**
   * Initiate Discord OAuth login
   * Returns the OAuth URL to redirect to
   */
  async login(redirectPath: string = '/'): Promise<string> {
    const response = await botApi.get('/oauth/login', {
      params: {
        redirect: redirectPath,
      },
    });

    // Sapphire's OAuth will redirect, so we return the URL
    return (
      response.request.responseURL ||
      `${BOT_API_URL}/oauth/login?redirect=${encodeURIComponent(redirectPath)}`
    );
  },

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await botApi.post('/api/oauth/logout');
  },

  /**
   * Get current user information
   */
  async getCurrentUser() {
    const response = await botApi.get('/api/users/@me');
    return response.data;
  },

  /**
   * Get user's guilds
   */
  async getUserGuilds() {
    const response = await botApi.get('/api/users/@me/guilds');
    return response.data;
  },
};
