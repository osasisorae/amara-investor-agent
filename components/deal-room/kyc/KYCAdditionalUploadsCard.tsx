'use client';

import { useEffect, useRef, useState } from 'react';
import type { KycAdditionalUploadsComponentData } from '@/lib/chat/components';
import type { KycAdditionalDocumentType } from '@/lib/kyc/requirements';

interface UploadState {
  documentId?: string;
  filename?: string;
  error?: string;
  uploading: boolean;
}

interface PersistedKycDocument {
  id: string;
  doc_type: string;
  filename: string;
  uploaded_at: number;
}

interface UploadResponsePayload {
  filename?: string;
  document?: PersistedKycDocument;
  error?: string;
}

interface KYCAdditionalUploadsCardProps {
  leadId: string;
  data?: KycAdditionalUploadsComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.pdf';

function isAcceptedFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'pdf'].includes(extension || '');
}

async function parseJsonSafely<T>(
  response: Response
): Promise<T & { error?: string }> {
  const raw = await response.text();

  if (!raw) {
    return {} as T & { error?: string };
  }

  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch (error) {
    console.error('Failed to parse JSON response:', error, raw);
    return {} as T & { error?: string };
  }
}

export function KYCAdditionalUploadsCard({
  leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCAdditionalUploadsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const requiredDocuments = data?.requiredDocuments || [];
  const requiredDocTypes = requiredDocuments.map((document) => document.docType);
  const requiredDocTypesKey = requiredDocTypes.join('|');
  const [uploads, setUploads] = useState<
    Partial<Record<KycAdditionalDocumentType, UploadState>>
  >({});
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const keepCardInView = (behavior: ScrollBehavior = 'auto') => {
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({
        block: 'nearest',
        behavior,
      });
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadExistingUploads = async () => {
      setLoadingExisting(true);
      setLoadError('');

      try {
        const response = await fetch(`/api/kyc/${leadId}/documents`, {
          cache: 'no-store',
        });
        const payload = await parseJsonSafely<{
          documents?: PersistedKycDocument[];
        }>(response);

        if (!response.ok) {
          if (!cancelled) {
            setUploads({});
            setLoadError(
              response.status === 401
                ? 'Your secure investor session expired. Reopen the chat access link and try again.'
                : payload.error || 'Failed to load your uploaded documents.'
            );
            keepCardInView('auto');
          }
          return;
        }

        const nextUploads: Partial<Record<KycAdditionalDocumentType, UploadState>> =
          {};

        for (const document of payload.documents || []) {
          if (!requiredDocTypes.includes(document.doc_type as KycAdditionalDocumentType)) {
            continue;
          }

          nextUploads[document.doc_type as KycAdditionalDocumentType] = {
            documentId: document.id,
            filename: document.filename,
            uploading: false,
          };
        }

        if (!cancelled) {
          setUploads(nextUploads);
          keepCardInView('auto');
        }
      } catch (error) {
        console.error('Failed to load persisted funding uploads:', error);
        if (!cancelled) {
          setUploads({});
          setLoadError('Failed to load your uploaded documents.');
          keepCardInView('auto');
        }
      } finally {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      }
    };

    void loadExistingUploads();

    return () => {
      cancelled = true;
    };
  }, [leadId, data?.sourceOfFundsType, requiredDocTypesKey]);

  const updateSlot = (
    slot: KycAdditionalDocumentType,
    patch: Partial<UploadState>
  ) => {
    setUploads((current) => ({
      ...current,
      [slot]: {
        uploading: false,
        ...(current[slot] || {}),
        ...patch,
      },
    }));
  };

  const uploadFile = async (
    slot: KycAdditionalDocumentType,
    file: File
  ) => {
    if (disabled || submitting || loadingExisting || uploads[slot]?.filename) {
      return;
    }

    if (!isAcceptedFile(file)) {
      updateSlot(slot, {
        error: 'Only JPG, JPEG, PNG, and PDF files are allowed.',
        filename: undefined,
        uploading: false,
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateSlot(slot, {
        error: 'Each file must be 5MB or smaller.',
        filename: undefined,
        uploading: false,
      });
      return;
    }

    updateSlot(slot, {
      error: undefined,
      filename: undefined,
      uploading: true,
    });
    setSubmitError('');
    keepCardInView('auto');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', slot);

      const response = await fetch(`/api/kyc/${leadId}/upload`, {
        method: 'POST',
        body: formData,
      });
      const payload = await parseJsonSafely<UploadResponsePayload>(response);

      if (!response.ok || !payload.filename || !payload.document?.id) {
        updateSlot(slot, {
          error:
            response.status === 401
              ? 'Your secure investor session expired. Reopen the chat access link and try again.'
              : payload.error || 'Upload failed.',
          filename: undefined,
          documentId: undefined,
          uploading: false,
        });
        keepCardInView();
        return;
      }

      updateSlot(slot, {
        documentId: payload.document.id,
        error: undefined,
        filename: payload.document.filename || payload.filename,
        uploading: false,
      });
      keepCardInView();
    } catch (error) {
      console.error('Failed to upload funding evidence:', error);
      updateSlot(slot, {
        error: 'Upload failed.',
        filename: undefined,
        uploading: false,
      });
      keepCardInView();
    }
  };

  const removeUploadedFile = async (slot: KycAdditionalDocumentType) => {
    const currentUpload = uploads[slot];

    if (
      disabled ||
      submitting ||
      loadingExisting ||
      !currentUpload?.documentId ||
      !currentUpload.filename
    ) {
      return;
    }

    updateSlot(slot, {
      documentId: currentUpload.documentId,
      error: undefined,
      filename: currentUpload.filename,
      uploading: true,
    });

    try {
      const response = await fetch(`/api/kyc/${leadId}/documents`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: currentUpload.documentId,
        }),
      });
      const payload = await parseJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        updateSlot(slot, {
          documentId: currentUpload.documentId,
          error: payload.error || 'Failed to remove file.',
          filename: currentUpload.filename,
          uploading: false,
        });
        keepCardInView();
        return;
      }

      setUploads((current) => {
        const next = { ...current };
        delete next[slot];
        return next;
      });
      keepCardInView();
    } catch (error) {
      console.error('Failed to remove funding evidence:', error);
      updateSlot(slot, {
        documentId: currentUpload.documentId,
        error: 'Failed to remove file.',
        filename: currentUpload.filename,
        uploading: false,
      });
      keepCardInView();
    }
  };

  const submit = async () => {
    if (disabled || submitting || loadingExisting) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await onSendPrompt('Funding documents uploaded');
    } catch (error) {
      console.error('Failed to submit funding evidence:', error);
      setSubmitError('Failed to continue after uploads.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5"
    >
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Source of funds uploads
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Upload any source of funds evidence you already have'}
      </h3>
      <p className="mt-2 text-sm leading-6 text-futurex-muted">
        Funding source: {data?.sourceOfFundsLabel || 'Selected funding source'}
      </p>
      <p className="mt-2 text-sm leading-6 text-futurex-muted">
        Upload any supporting evidence you already have now. These files help the compliance team review faster, but missing items here should not stop you from continuing.
      </p>

      {loadError ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {requiredDocuments.map((document) => {
          const state = uploads[document.docType];
          const hasUploadedFile = Boolean(state?.filename);

          return (
            <div
              key={document.docType}
              className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-futurex-ink">
                    {document.label}
                    {!document.required ? (
                      <span className="ml-2 text-xs font-normal uppercase tracking-[0.12em] text-futurex-muted">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-futurex-muted">
                    {document.description}
                  </div>
                </div>
                {hasUploadedFile ? (
                  <button
                    type="button"
                    onClick={() => void removeUploadedFile(document.docType)}
                    disabled={disabled || submitting || state?.uploading}
                    className="inline-flex items-center rounded-full border border-rose-500/30 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-400 hover:text-rose-50 disabled:opacity-50"
                  >
                    {state?.uploading ? 'Removing...' : 'Remove'}
                  </button>
                ) : (
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold">
                    <span>
                      {state?.uploading
                        ? 'Uploading...'
                        : loadingExisting
                          ? 'Loading...'
                          : 'Choose file'}
                    </span>
                    <input
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      disabled={
                        disabled ||
                        submitting ||
                        loadingExisting ||
                        state?.uploading ||
                        hasUploadedFile
                      }
                      onChange={(event) => {
                        try {
                          const file = event.target.files?.[0];

                          if (file) {
                            void uploadFile(document.docType, file);
                          }
                        } catch (error) {
                          console.error(
                            'Failed to start source-of-funds upload from file input:',
                            error
                          );
                          updateSlot(document.docType, {
                            error: 'Failed to read the selected file.',
                            filename: undefined,
                            documentId: undefined,
                            uploading: false,
                          });
                        } finally {
                          event.currentTarget.blur();
                          event.currentTarget.value = '';
                          keepCardInView('auto');
                        }
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                )}
              </div>

              {state?.filename ? (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  Uploaded: {state.filename} ✓
                </div>
              ) : null}

              {state?.error ? (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {state.error}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {submitError ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {submitError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={disabled || submitting || loadingExisting}
        className="mt-5 rounded-full bg-futurex-gold px-5 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Continuing...' : 'Continue to declarations'}
      </button>
    </div>
  );
}
