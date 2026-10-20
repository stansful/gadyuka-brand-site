'use client';

import { ImagePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactElement } from 'react';

import { addGalleryItems } from '@/lib/admin/actions/gallery';

import { MediaLibraryDialog } from '../media/MediaLibraryDialog';
import { Button } from '../ui/Button';
import { useActionSubmit } from '../ui/useActionSubmit';

/** «Добавить несколько»: choose/upload many images at once → appended to the gallery (published). */
export function GalleryBulkAdd(): ReactElement {
  const t = useTranslations('admin.gallery');
  const [open, setOpen] = useState(false);
  const { pending, run } = useActionSubmit();

  return (
    <>
      <Button
        variant="secondary"
        pending={pending}
        icon={<ImagePlus className="size-4" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        {t('addMany')}
      </Button>
      <MediaLibraryDialog
        open={open}
        multiple
        title={t('addManyTitle')}
        onClose={() => setOpen(false)}
        onSelect={media => {
          if (media.length === 0) return;
          run(() => addGalleryItems({ mediaIds: media.map(item => item.id), published: true }));
        }}
      />
    </>
  );
}
