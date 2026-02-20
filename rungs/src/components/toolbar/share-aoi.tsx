import { useState } from 'react';
import { useStore } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShareOutlined } from '@mui/icons-material';
import { ShareDialog } from './share-dialog';
import { createShare, type RateLimitInfo } from '@/lib/aoi-share-service';

export default function ShareAOIButton() {
  const currentAOI = useStore((s) => s.aoi);
  const addLog = useStore((s) => s.addLog);
  const openStatusPanelWithTab = useStore((s) => s.openStatusPanelWithTab);

  const [isSharing, setIsSharing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  async function handleShare() {
    if (!currentAOI) return;

    setIsSharing(true);
    setDialogOpen(true);
    setShareUrl(null);

    const result = await createShare(currentAOI);

    if (result.success) {
      setShareUrl(result.shareUrl);
      setRateLimit(result.rateLimit ?? null);
      const cacheMessage = result.fromCache ? ' (from cache)' : '';
      addLog({ type: 'info', message: `Created share link for "${currentAOI.name}"${cacheMessage}` });
    } else {
      setRateLimit(result.rateLimit ?? null);
      addLog({ type: 'error', message: `Failed to create share link: ${result.error}` });
      openStatusPanelWithTab('errors');
      setDialogOpen(false);
    }

    setIsSharing(false);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setShareUrl(null);
    setRateLimit(null);
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" disabled={!currentAOI || isSharing} onClick={handleShare}>
            <ShareOutlined className="size-6" />
            Share
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Share AOI</p>
        </TooltipContent>
      </Tooltip>

      <ShareDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        shareUrl={shareUrl}
        isLoading={isSharing}
        rateLimit={rateLimit}
      />
    </>
  );
}
