export function resolveSummaryChannelId(
  configuredChannelId: string | null | undefined,
  recordingChannelId: string | null | undefined
): string | null {
  return configuredChannelId?.trim() || recordingChannelId?.trim() || null;
}
