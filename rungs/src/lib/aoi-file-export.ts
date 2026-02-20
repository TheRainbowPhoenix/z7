import type { AOIDefinition } from '@repo/plc-core';
import { serializeDsl as serializeAoiToDsl, serializeToRungs } from '@repo/aoi-io';
import type { AOIDefinition as AoiIoDefinition } from '@repo/aoi-io';
import { analytics } from './posthog-analytics';

export type ExportFormat = 'rungs' | 'dsl';

const FILE_TYPE_CONFIG: Record<
  ExportFormat,
  { description: string; accept: Record<string, string[]>; extension: string }
> = {
  rungs: {
    description: 'Rungs File',
    accept: { 'application/yaml': ['.rungs'] },
    extension: '.rungs',
  },
  dsl: { description: 'DSL File', accept: { 'text/plain': ['.dsl'] }, extension: '.dsl' },
};

function stripKnownExtensions(name: string): string {
  return name.replace(/(\.(rungs|dsl))+$/i, '');
}

function convertToAoiIoFormat(aoi: AOIDefinition): AoiIoDefinition {
  return {
    ...aoi,
    tags: aoi.tags as AoiIoDefinition['tags'],
  };
}

function serializeAOIForFormat(aoi: AOIDefinition, format: ExportFormat): string {
  const aoiData = convertToAoiIoFormat(aoi);
  return format === 'dsl' ? serializeAoiToDsl(aoiData) : serializeToRungs(aoiData);
}

async function saveWithNativePicker(aoi: AOIDefinition, format: ExportFormat): Promise<boolean> {
  if (typeof window.showSaveFilePicker !== 'function') {
    return false;
  }

  if (!window.isSecureContext) {
    return false;
  }

  const config = FILE_TYPE_CONFIG[format];
  const baseName = stripKnownExtensions(aoi.name);
  const suggestedName = `${baseName}${config.extension}`;

  try {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: config.description, accept: config.accept }],
      excludeAcceptAllOption: true,
    });

    const content = serializeAOIForFormat(aoi, format);

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      return false;
    }
    throw error;
  }
}

async function saveWithFallbackDownload(aoi: AOIDefinition, format: ExportFormat): Promise<void> {
  const content = serializeAOIForFormat(aoi, format);
  const config = FILE_TYPE_CONFIG[format];
  const mimeType = Object.keys(config.accept)[0];

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const baseName = stripKnownExtensions(aoi.name);
  anchor.download = `${baseName}${config.extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportAOI(aoi: AOIDefinition, format: ExportFormat = 'rungs'): Promise<void> {
  const savedWithNative = await saveWithNativePicker(aoi, format);
  if (!savedWithNative) {
    await saveWithFallbackDownload(aoi, format);
  }
  analytics.trackAoiExported(aoi, format);
}

export function isDevMode(): boolean {
  return import.meta.env.MODE === 'development';
}
