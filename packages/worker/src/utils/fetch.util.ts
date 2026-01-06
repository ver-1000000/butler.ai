import type { RequestInfo, RequestInit, Response } from 'node-fetch';

/**
 * node-fetchを動的にインポートするユーティリティ関数
 * 
 * node-fetchはESMモジュールであり、CommonJSとの互換性のため動的インポートを使用する必要があります。
 * これにより、実行時にモジュールを読み込むことで、TypeScriptのビルドとNode.jsの実行環境の両方で動作します。
 */
export async function dynamicFetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, init);
}
