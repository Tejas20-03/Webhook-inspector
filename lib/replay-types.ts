export type Replay = {
  id: string;
  requestId: string;
  targetUrl: string;
  statusCode: number | null;
  durationMs: number | null;
  responseSnippet: string | null;
  error: string | null;
  createdAt: string;
};
