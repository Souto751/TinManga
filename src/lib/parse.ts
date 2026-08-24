import { makeId, titleFromFilename } from './hash';

export type ParsedTitle = {
  series: string;
  seriesKey: string;
  seriesId: string;
  volume?: number;
  volumeLabel: string;
  displayName: string;
};

export function normalizeSeriesKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_.;]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function seriesIdFromName(name: string): string {
  return makeId(normalizeSeriesKey(name));
}

function tidy(value: string): string {
  return value.replace(/\s*[-–:|]\s*$/g, '').replace(/\s+/g, ' ').trim();
}

function compactTitle(filename: string): string {
  return titleFromFilename(filename)
    .replace(/\((?:\s*#?\d+\s*[-–]\s*#?\d+\s*)\)/g, '')
    .replace(/\[(?:scanlation|digital|comic|[^\]]{1,40})\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseComicFilename(filename: string, folderName?: string): ParsedTitle {
  const cleaned = compactTitle(filename);
  const folder = folderName ? tidy(folderName) : undefined;

  if (folder) {
    const onlyVolume = cleaned.match(/^(?:Tomo|Tomos|Vol\.?|Volume|Tome|v\.?)\s*0*(\d+)\b/i);
    if (onlyVolume) {
      return buildParsed(folder, Number(onlyVolume[1]));
    }
  }

  const patterns: RegExp[] = [
    /^(.+?)\s*[-–:]\s*(Tomo|Tomos|Vol\.?|Volume|Tome)\s*0*(\d+)\b/i,
    /^(.+?)\s+(Tomo|Tomos|Vol\.?|Volume|Tome)\s*0*(\d+)\b/i,
    /^(.+?)\s+v\.?\s*0*(\d{1,3})\b/i,
    /^(.+?)\s+#0*(\d{1,3})\b/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match) {
      continue;
    }
    const series = tidy(match[1]);
    const volume = Number(match[match.length - 1]);
    if (!series || Number.isNaN(volume)) {
      continue;
    }
    return buildParsed(series, volume);
  }

  const trailing = cleaned.match(/^(.*?)\s+0*(\d{1,3})$/);
  if (trailing) {
    const fromName = tidy(trailing[1]);
    const volume = Number(trailing[2]);
    const series = folder || fromName;
    if (series && !Number.isNaN(volume)) {
      return buildParsed(series, volume, fromName && fromName !== series ? cleaned : undefined);
    }
  }

  return buildParsed(folder || cleaned, undefined, folder ? cleaned : undefined);
}

function buildParsed(series: string, volume?: number, explicitDisplay?: string): ParsedTitle {
  const volumeLabel = volume != null ? `Tomo ${volume}` : explicitDisplay || series;
  return {
    series,
    seriesKey: normalizeSeriesKey(series),
    seriesId: seriesIdFromName(series),
    volume,
    volumeLabel,
    displayName: explicitDisplay || volumeLabel,
  };
}
