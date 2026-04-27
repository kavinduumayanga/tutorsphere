export type TrustedResourceItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  type: string;
};

export type GenerateTrustedResourcesInput = {
  topic: string;
};

export type GenerateTrustedResourcesResponse = {
  assistant: string;
  topic: string;
  resources: TrustedResourceItem[];
};
