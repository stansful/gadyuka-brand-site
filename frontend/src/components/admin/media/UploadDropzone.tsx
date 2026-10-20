'use client';

import { clsx } from 'clsx';
import { CircleCheck, CloudUpload, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactElement } from 'react';

import { ACCEPTED_FORMATS_LABEL, IMAGE_ACCEPT_ATTRIBUTE, MAX_UPLOAD_MEGABYTES } from '@/lib/admin/media-constants';

import type { UploadItem } from './useUploadQueue';

/** Drag & drop area + file chooser for image uploads (multiple files). */
export function UploadDropzone({
  onFiles,
  compact = false,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  compact?: boolean;
  disabled?: boolean;
}): ReactElement {
  const t = useTranslations('admin.media.upload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const accept = (list: FileList | null): void => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      onDragEnter={event => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      }}
      onDragLeave={event => {
        if (event.currentTarget.contains(event.relatedTarget instanceof Node ? event.relatedTarget : null)) return;
        setDragging(false);
      }}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) accept(event.dataTransfer.files);
      }}
      className={clsx(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors',
        compact ? 'px-4 py-4' : 'px-6 py-10',
        dragging ? 'border-beige bg-beige/5' : 'border-line-strong bg-panel/60',
        disabled && 'opacity-60',
      )}
    >
      <CloudUpload className={clsx('text-muted', compact ? 'size-6' : 'size-9')} aria-hidden />
      <p className="text-sm text-fg">
        {t.rich('dropHere', {
          choose: chunks => (
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-beige underline-offset-4 hover:underline disabled:cursor-not-allowed"
            >
              {chunks}
            </button>
          ),
        })}
      </p>
      <p className="text-xs text-muted">
        {t('limits', { formats: ACCEPTED_FORMATS_LABEL, size: MAX_UPLOAD_MEGABYTES })}
      </p>
      <label htmlFor={inputId} className="sr-only">
        {t('chooseLabel')}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={event => {
          accept(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}

/** Progress list of the upload queue. */
export function UploadProgressList({
  items,
  onClear,
}: {
  items: UploadItem[];
  onClear?: () => void;
}): ReactElement | null {
  const t = useTranslations('admin.media.upload');
  if (items.length === 0) return null;
  const finished = items.some(item => item.status === 'done' || item.status === 'error');
  return (
    <div className="rounded-lg border border-line bg-panel" aria-live="polite">
      <ul className="max-h-48 divide-y divide-line overflow-y-auto">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-3 px-3 py-2 text-xs">
            {item.status === 'done' ? (
              <CircleCheck className="size-4 shrink-0 text-beige" aria-label={t('done')} />
            ) : item.status === 'error' ? (
              <TriangleAlert className="size-4 shrink-0 text-red-fg" aria-label={t('error')} />
            ) : (
              <LoaderCircle className="size-4 shrink-0 animate-spin text-muted" aria-label={t('uploading')} />
            )}
            <span className="min-w-0 flex-1 truncate text-fg" title={item.name}>
              {item.name}
            </span>
            {item.status === 'error' ? (
              <span className="max-w-[50%] truncate text-red-fg" title={item.error}>
                {item.error}
              </span>
            ) : item.status === 'uploading' || item.status === 'queued' ? (
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-raised-hi">
                <span
                  className="block h-full bg-beige transition-[width]"
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              </span>
            ) : (
              <span className="text-muted">{t('ready')}</span>
            )}
          </li>
        ))}
      </ul>
      {finished && onClear ? (
        <div className="border-t border-line px-3 py-1.5 text-right">
          <button type="button" onClick={onClear} className="text-xs text-muted hover:text-fg">
            {t('clear')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
