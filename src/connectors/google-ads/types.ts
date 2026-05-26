export type GoogleAdsConfig = {
  customerId: string;
  loginCustomerId?: string;
};

export type GoogleAdsRow = Record<string, unknown> & {
  segments?: { date?: string };
  campaign?: { id?: string; name?: string };
  adGroup?: { id?: string; name?: string };
  adGroupCriterion?: { keyword?: { text?: string; matchType?: string } };
  metrics?: {
    clicks?: string;
    impressions?: string;
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
  };
};

export type GoogleAdsSearchResponse = {
  results?: GoogleAdsRow[];
  nextPageToken?: string;
  fieldMask?: string;
};

export type AccessibleCustomersResponse = {
  resourceNames?: string[];
};
