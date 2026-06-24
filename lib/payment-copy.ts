export function getUsdTransferNotice(showCrypto: boolean): string {
  if (showCrypto) {
    return 'SWIFT transfers are currently not supported on this USD receiving account. If your bank requires SWIFT, use the NGN or crypto options instead, or contact FutureX before initiating payment.';
  }

  return 'SWIFT transfers are currently not supported on this USD receiving account. If your bank requires SWIFT, use the NGN option instead, or contact FutureX before initiating payment.';
}
