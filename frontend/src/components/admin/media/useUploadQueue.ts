'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AdminMedia } from './media-types';

import { mediaProblemText, precheckFile, uploadMediaFile } from './media-api';

export type UploadItem = {
  key: string;
  name: string;
  /** 0..1 */
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  /** Translated error text (admin.media.errors or the server's message). */
  error?: string;
};

const CONCURRENCY = 2;

/**
 * Upload queue: files are pre-checked, then uploaded two at a time with progress.
 * `onUploaded` is called for every stored file (in completion order).
 */
export function useUploadQueue(onUploaded: (media: AdminMedia) => void): {
  items: UploadItem[];
  busy: boolean;
  enqueue: (files: File[]) => void;
  clearFinished: () => void;
} {
  const t = useTranslations('admin.media');
  const tErrors = useTranslations('admin.media.errors');
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<Array<{ key: string; file: File }>>([]);
  const active = useRef(0);
  const counter = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const update = useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems(current => current.map(item => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const pump = useCallback(
    function pumpQueue(): void {
      while (active.current < CONCURRENCY && queue.current.length > 0) {
        const next = queue.current.shift();
        if (!next) break;
        active.current += 1;
        update(next.key, { status: 'uploading' });
        void uploadMediaFile(next.file, progress => update(next.key, { progress })).then(result => {
          active.current -= 1;
          if (result.ok) {
            update(next.key, { status: 'done', progress: 1 });
            onUploadedRef.current(result.media);
          } else {
            const error = mediaProblemText(result.problem, tErrors);
            update(next.key, { status: 'error', error });
            toast.error(t('upload.failed', { name: next.file.name, error }));
          }
          pumpQueue();
        });
      }
    },
    [update, t, tErrors],
  );

  const enqueue = useCallback(
    (files: File[]) => {
      const accepted: UploadItem[] = [];
      for (const file of files) {
        counter.current += 1;
        const key = `upload-${counter.current}`;
        const problem = precheckFile(file);
        if (problem) {
          const error = mediaProblemText(problem, tErrors);
          accepted.push({ key, name: file.name, progress: 0, status: 'error', error });
          toast.error(t('upload.failed', { name: file.name, error }));
          continue;
        }
        accepted.push({ key, name: file.name, progress: 0, status: 'queued' });
        queue.current.push({ key, file });
      }
      setItems(current => [...accepted, ...current].slice(0, 50));
      pump();
    },
    [pump, t, tErrors],
  );

  const clearFinished = useCallback(() => {
    setItems(current => current.filter(item => item.status === 'queued' || item.status === 'uploading'));
  }, []);

  const busy = items.some(item => item.status === 'queued' || item.status === 'uploading');
  return { items, busy, enqueue, clearFinished };
}
