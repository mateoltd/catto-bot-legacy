import axios, { type AxiosInstance } from 'axios';
import { emitSessionExpired } from '@/lib/auth-events';

function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) emitSessionExpired();
      return Promise.reject(error);
    },
  );

  return client;
}

export const botApi = createApiClient('/');
export const dashboardApi = createApiClient('/api');
