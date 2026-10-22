export type RemoteManga = {
  id: string;
  title: string;
  description: string;
  status: string;
  year?: number;
  tags: string[];
  coverUri?: string;
  /** safe | suggestive | erotica | pornographic — el mismo valor que comparten todos sus capítulos. */
  contentRating?: string;
};

export type RemoteChapter = {
  id: string;
  chapter: string;
  title: string;
  volume: string;
  language: string;
  pages: number;
  publishAt?: string;
  /** Si tiene valor, el capítulo no está alojado en MangaDex — es un link
   * a un lector oficial externo (MangaPlus, Viz, etc.). Se abre en el
   * navegador in-app en vez de en el lector propio. */
  externalUrl?: string;
};
