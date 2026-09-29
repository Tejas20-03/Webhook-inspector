export type CapturedRequest = {
  id: string;
  endpointId: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  bodyEncoding: "utf8" | "base64";
  bodySize: number;
  contentType: string | null;
  ip: string | null;
  receivedAt: string;
};
