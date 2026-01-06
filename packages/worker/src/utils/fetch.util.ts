import type { RequestInfo, RequestInit, Response } from 'node-fetch';

/**
 * node-fetchを動的にインポートするユーティリティ関数
 */
export async function dynamicFetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, init);
}
