'use client';

import { useState } from 'react';
import type { PaymentInstructionsComponentData } from '@/lib/chat/components';
import { getUsdTransferNotice } from '@/lib/payment-copy';

interface PaymentInstructionsCardProps {
  data: PaymentInstructionsComponentData;
}

function formatNaira(value: number): string {
  return `₦${value.toLocaleString('en-NG')}`;
}

function formatApproximateUsd(slotCount: number): string {
  return `$${(slotCount * 3300).toLocaleString('en-US')}`;
}

function InfoRow(props: {
  label: string;
  value: string;
  copyValue?: string;
  copied: boolean;
  onCopy: (value: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-futurex-muted">
          {props.label}
        </div>
        <div className="mt-2 break-all text-sm leading-6 text-futurex-ink">
          {props.value}
        </div>
      </div>
      {props.copyValue ? (
        <button
          type="button"
          onClick={() => props.onCopy(props.copyValue!, props.copyKey)}
          className="rounded-full border border-futurex-line px-3 py-1 text-xs font-medium text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
        >
          {props.copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
    </div>
  );
}

export function PaymentInstructionsCard({
  data,
}: PaymentInstructionsCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const showCrypto = data.slotCount >= 2;
  const usdTransferNotice = getUsdTransferNotice(showCrypto);

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1600);
    } catch (error) {
      console.error('Failed to copy payment detail:', error);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-gold-border bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Payment instructions
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft px-4 py-4">
        <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
          Payment reference
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-base font-semibold text-futurex-ink">
            {data.paymentReference}
          </div>
          <button
            type="button"
            onClick={() => handleCopy(data.paymentReference, 'payment_reference')}
            className="rounded-full border border-futurex-gold px-3 py-1 text-xs font-medium text-futurex-gold transition hover:bg-futurex-surface"
          >
            {copiedKey === 'payment_reference' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-futurex-ink/80">
          You must include this reference in your transfer description.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
          Nigerian Naira (NGN)
        </div>
        <div className="mt-3 space-y-3">
          <InfoRow
            label="Bank"
            value={data.paymentDetails.ngn.bank}
            copied={copiedKey === 'ngn_bank'}
            onCopy={handleCopy}
            copyKey="ngn_bank"
          />
          <InfoRow
            label="Account name"
            value={data.paymentDetails.ngn.accountName}
            copied={copiedKey === 'ngn_account_name'}
            onCopy={handleCopy}
            copyKey="ngn_account_name"
          />
          <InfoRow
            label="Account number"
            value={data.paymentDetails.ngn.accountNumber}
            copyValue={data.paymentDetails.ngn.accountNumber}
            copied={copiedKey === 'ngn_account_number'}
            onCopy={handleCopy}
            copyKey="ngn_account_number"
          />
          <InfoRow
            label="Sort code"
            value={data.paymentDetails.ngn.sortCode}
            copyValue={data.paymentDetails.ngn.sortCode}
            copied={copiedKey === 'ngn_sort_code'}
            onCopy={handleCopy}
            copyKey="ngn_sort_code"
          />
          <InfoRow
            label="Amount"
            value={formatNaira(data.commitmentAmountNgn)}
            copied={false}
            onCopy={handleCopy}
            copyKey="ngn_amount"
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
          US Dollars (USD)
        </div>
        <div className="mt-3 space-y-3">
          <InfoRow
            label="Bank"
            value={data.paymentDetails.usd.bank}
            copied={false}
            onCopy={handleCopy}
            copyKey="usd_bank"
          />
          <InfoRow
            label="Account name"
            value={data.paymentDetails.usd.accountName}
            copied={false}
            onCopy={handleCopy}
            copyKey="usd_account_name"
          />
          <InfoRow
            label="Account number"
            value={data.paymentDetails.usd.accountNumber}
            copyValue={data.paymentDetails.usd.accountNumber}
            copied={copiedKey === 'usd_account_number'}
            onCopy={handleCopy}
            copyKey="usd_account_number"
          />
          <InfoRow
            label="Routing"
            value={data.paymentDetails.usd.routingNumber}
            copyValue={data.paymentDetails.usd.routingNumber}
            copied={copiedKey === 'usd_routing'}
            onCopy={handleCopy}
            copyKey="usd_routing"
          />
          <InfoRow
            label="Approximate amount"
            value={formatApproximateUsd(data.slotCount)}
            copied={false}
            onCopy={handleCopy}
            copyKey="usd_amount"
          />
        </div>
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
          {usdTransferNotice}
        </div>
      </div>

      {showCrypto ? (
        <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
            Crypto
          </div>
          <div className="mt-3 space-y-3">
            <InfoRow
              label="USDC on Ethereum"
              value={data.paymentDetails.crypto.usdc_eth}
              copyValue={data.paymentDetails.crypto.usdc_eth}
              copied={copiedKey === 'usdc_eth'}
              onCopy={handleCopy}
              copyKey="usdc_eth"
            />
            <InfoRow
              label="USDC on Solana"
              value={data.paymentDetails.crypto.usdc_sol}
              copyValue={data.paymentDetails.crypto.usdc_sol}
              copied={copiedKey === 'usdc_sol'}
              onCopy={handleCopy}
              copyKey="usdc_sol"
            />
            <InfoRow
              label="USDC on BNB Chain"
              value={data.paymentDetails.crypto.usdc_bnb}
              copyValue={data.paymentDetails.crypto.usdc_bnb}
              copied={copiedKey === 'usdc_bnb'}
              onCopy={handleCopy}
              copyKey="usdc_bnb"
            />
            <InfoRow
              label="USDT on BNB Chain"
              value={data.paymentDetails.crypto.usdt_bnb}
              copyValue={data.paymentDetails.crypto.usdt_bnb}
              copied={copiedKey === 'usdt_bnb'}
              onCopy={handleCopy}
              copyKey="usdt_bnb"
            />
            <InfoRow
              label="USDT on TRON (TRX)"
              value={data.paymentDetails.crypto.usdt_trx}
              copyValue={data.paymentDetails.crypto.usdt_trx}
              copied={copiedKey === 'usdt_trx'}
              onCopy={handleCopy}
              copyKey="usdt_trx"
            />
          </div>
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            Only send the exact token on the correct network. Sending to a
            wrong network will result in permanent loss.
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
          What happens next
        </div>
        <p className="mt-3 text-sm leading-6 text-futurex-muted">
          Once you&apos;ve sent funds, reply here or email
          {' '}
          <span className="text-futurex-ink">info@investfuturex.com</span>
          {' '}
          with your transfer confirmation. FutureX will verify and confirm your
          allocation within 2 business days.
        </p>
      </div>
    </div>
  );
}
