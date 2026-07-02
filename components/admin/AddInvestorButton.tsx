'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/feedback-provider';

interface AddInvestorButtonProps {
  adminEmail: string;
  onUnauthorized: (response: Response) => boolean;
  onAdded?: () => void;
  buttonLabel?: string;
  buttonClassName?: string;
}

export function AddInvestorButton({
  adminEmail,
  onUnauthorized,
  onAdded,
  buttonLabel = 'Add Investor',
  buttonClassName = 'rounded-full bg-futurex-gold px-4 py-2 text-sm font-semibold text-futurex-bg transition hover:opacity-90',
}: AddInvestorButtonProps) {
  const { notify } = useFeedback();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setNotes('');
  };

  const close = () => {
    if (adding) {
      return;
    }

    setOpen(false);
    resetForm();
  };

  const addOfferee = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);

    try {
      const response = await fetch('/api/admin/offeree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          notes,
          addedBy: adminEmail,
        }),
      });

      if (onUnauthorized(response)) {
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        notify({
          title: 'Investor not added',
          message: error.error || 'Failed to add investor.',
          tone: 'error',
        });
        return;
      }

      notify({
        title: 'Investor added',
        message: 'Offeree added and outreach email sent.',
        tone: 'success',
      });
      onAdded?.();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add offeree:', error);
      notify({
        title: 'Investor not added',
        message: 'Failed to add investor.',
        tone: 'error',
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-futurex-line bg-futurex-surface p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-futurex-gold">
                  Offeree Register
                </div>
                <h2 className="mt-2 font-serif text-3xl text-futurex-ink">
                  Add Investor
                </h2>
                <p className="mt-2 text-sm leading-6 text-futurex-muted">
                  Add a verified investor to the offeree register and trigger the
                  initial outreach flow.
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-full border border-futurex-line px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-futurex-muted transition hover:border-futurex-gold hover:text-futurex-gold"
              >
                Close
              </button>
            </div>

            <form onSubmit={addOfferee} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-futurex-muted">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                  placeholder="investor@example.com"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-futurex-muted">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-futurex-muted">
                    Admin Owner
                  </label>
                  <div className="rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-sm text-futurex-muted">
                    {adminEmail}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-futurex-muted">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                  placeholder="Source, referral context, compliance notes, or anything the team should remember."
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-muted transition hover:border-futurex-gold hover:text-futurex-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-full bg-futurex-gold px-5 py-2 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add & Send Outreach'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
