export type DataForSeoConfig = {
  login: string;
  password: string;
};

export type DfsSerpItem = {
  type: string;
  rank_absolute?: number;
  rank_group?: number;
  domain?: string;
  url?: string;
  title?: string;
  description?: string;
  display_url?: string;
};

export type DfsSerpTask = {
  status_code: number;
  status_message: string;
  cost: number;
  result?: Array<{
    keyword: string;
    type: string;
    se_domain: string;
    location_code: number;
    language_code: string;
    items?: DfsSerpItem[];
  }>;
};

export type DfsApiResponse<T> = {
  status_code: number;
  status_message: string;
  cost: number;
  tasks?: T[];
};

export type DfsKeywordOverviewItem = {
  keyword: string;
  keyword_info?: {
    search_volume?: number;
    cpc?: number;
    competition?: number;
    competition_level?: string;
  };
};
