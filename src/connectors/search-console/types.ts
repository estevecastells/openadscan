export type GscConfig = {
  siteUrl: string;
};

export type GscRow = {
  keys: string[]; // [query, page, country, device] in this app
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSearchAnalyticsResponse = {
  rows?: GscRow[];
  responseAggregationType?: string;
};

export type GscSitesListResponse = {
  siteEntry?: { siteUrl: string; permissionLevel?: string }[];
};
