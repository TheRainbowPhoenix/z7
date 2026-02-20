import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContentCopyOutlined, CheckOutlined } from '@mui/icons-material';
import type { RateLimitInfo } from '@/lib/aoi-share-service';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string | null;
  isLoading: boolean;
  rateLimit: RateLimitInfo | null;
}

export function ShareDialog({ open, onOpenChange, shareUrl, isLoading, rateLimit }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share AOI</DialogTitle>
          <DialogDescription>
            Anyone with this link can view and use this AOI.
            {rateLimit && (
              <span className="mt-1 block text-sm text-muted-foreground">
                {rateLimit.remaining} share{rateLimit.remaining !== 1 ? 's' : ''} remaining this hour.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex gap-2">
            <Input
              value="Creating share link..."
              readOnly
              disabled
              className="animate-pulse font-mono text-sm"
            />
            <Button variant="outline" size="icon" disabled className="shrink-0 animate-pulse">
              <ContentCopyOutlined className="size-4" />
            </Button>
          </div>
        ) : shareUrl ? (
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? (
                <CheckOutlined className="size-4 text-green-600" />
              ) : (
                <ContentCopyOutlined className="size-4" />
              )}
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
