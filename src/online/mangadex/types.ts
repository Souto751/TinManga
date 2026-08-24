export type RemoteManga = {
  id: string;
  title: string;
  description: string;
  status: string;
  year?: number;
  tags: string[];
  coverUri?: string;
};

export type RemoteChapter = {
  id: string;
  chapter: string;
  title: string;
  volume: string;
  language: string;
  pages: number;
  publishAt?: string;
};
