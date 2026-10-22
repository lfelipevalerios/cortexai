'use client';

import {
  AUTHOR_HEADER,
  type CreateNodeInput, type CreateWorkspaceInput, type FileVersion, type NodeFile, type NodeVersion,
  type UpdateNodeInput, type Workspace, type WorkspaceTree,
} from '@cortex/schemas';
import { getAuthor } from './author';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown | FormData): Promise<T> {
  const headers: Record<string, string> = { [AUTHOR_HEADER]: encodeURIComponent(getAuthor()) };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor do Córtex.');
  }
  if (!res.ok) {
    const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => undefined);
    throw new ApiError(res.status, msg ?? `Erro ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  workspaces: () => request<Workspace[]>('GET', '/workspaces'),
  createWorkspace: (input: CreateWorkspaceInput) => request<Workspace>('POST', '/workspaces', input),
  tree: (workspaceId: string) => request<WorkspaceTree>('GET', `/workspaces/${workspaceId}/tree`),
  createNode: (input: CreateNodeInput) => request<{ id: string }>('POST', '/nodes', input),
  updateNode: (id: string, input: UpdateNodeInput) => request<NodeVersion>('PATCH', `/nodes/${id}`, input),
  deleteNode: (id: string) => request<void>('DELETE', `/nodes/${id}`),
  versions: (id: string) => request<NodeVersion[]>('GET', `/nodes/${id}/versions`),
  restore: (id: string, version: number) => request<NodeVersion>('POST', `/nodes/${id}/versions/${version}/restore`),
  files: (nodeId: string) => request<NodeFile[]>('GET', `/nodes/${nodeId}/files`),
  upload: (nodeId: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return request<NodeFile>('POST', `/nodes/${nodeId}/files`, form);
  },
  fileVersions: (fileId: string) => request<FileVersion[]>('GET', `/files/${fileId}/versions`),
  deleteFile: (fileId: string) => request<void>('DELETE', `/files/${fileId}`),
  downloadUrl: (fileId: string, version?: number, inline = false) =>
    `${API_URL}/files/${fileId}/download?${new URLSearchParams({ ...(version ? { version: String(version) } : {}), ...(inline ? { inline: '1' } : {}) })}`,
};

/** Chaves de cache do React Query. */
export const keys = {
  workspaces: ['workspaces'] as const,
  tree: (ws: string) => ['tree', ws] as const,
  versions: (node: string) => ['versions', node] as const,
  files: (node: string) => ['files', node] as const,
  fileVersions: (file: string) => ['file-versions', file] as const,
};
