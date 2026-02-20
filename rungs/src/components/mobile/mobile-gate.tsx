import { useMemo, useState } from 'react';
import { ContentCopy, Link as LinkIcon, ShareOutlined } from '@mui/icons-material';
import { Button } from '@/components/ui/button';

function formatDisplayUrl(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function MobileGate() {
  const [shareUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '';
  });
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');

  const displayUrl = useMemo(() => formatDisplayUrl(shareUrl), [shareUrl]);

  async function copyLink() {
    if (!shareUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl, title: 'Rungs Studio' });
        setShareError('');
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setShareError('Sharing failed. Try copy link instead.');
      }
    }
    await copyLink();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">Rungs Studio</p>
          <h1 className="text-2xl font-semibold">Desktop required</h1>
          <p className="text-sm text-slate-600">
            Studio is optimized for large screens. Open on desktop to edit and run simulations. Use
            one of the options below to move this session to your computer.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left">
              <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Studio link
              </div>
              <div
                className="flex items-center gap-2 text-sm font-semibold text-slate-900"
                title={shareUrl}
              >
                <LinkIcon className="text-slate-400" fontSize="small" />
                <span className="truncate">{displayUrl || 'Loading link...'}</span>
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={copyLink} disabled={!shareUrl}>
              <ContentCopy fontSize="small" className="mr-2" />
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button type="button" onClick={shareLink} disabled={!shareUrl}>
              <ShareOutlined fontSize="small" className="mr-2" />
              Share
            </Button>
          </div>
          {shareError ? (
            <div className="text-xs font-semibold text-red-600">{shareError}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MobileGate;
