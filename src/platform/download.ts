// Offer the save as a file. Inside Claude the host shows a confirmation and, on iPhone, the share
// sheet (Save to Files); outside Claude it's an ordinary browser download.
import { errorCode, isEmbedded, useCapability } from './claude';

interface Downloads { save(r: { filename: string; data: string }): Promise<{ status: string }> }

export async function canDownload(): Promise<boolean> {
  if (!isEmbedded()) return true;
  return !!(await useCapability<Downloads>('downloads', 5_000));
}

export type DownloadResult = 'saved' | 'declined' | 'busy' | 'unavailable';

export async function downloadText(filename: string, text: string): Promise<DownloadResult> {
  const dl = await useCapability<Downloads>('downloads', 5_000);
  if (dl) {
    try {
      await dl.save({ filename, data: text });
      return 'saved';
    } catch (e) {
      const code = errorCode(e);
      return code === 'declined' ? 'declined' : code === 'rate_limited' ? 'busy' : 'unavailable';
    }
  }
  if (isEmbedded()) return 'unavailable';
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return 'saved';
  } catch {
    return 'unavailable';
  }
}
