export const TTL_OPTIONS = [
  { label: "En timme", value: 3600 },
  { label: "En dag", value: 86400 },
  { label: "En vecka", value: 604800 }
] as const;

export const MAX_FILE_SIZE_BYTES = 256 * 1024;
export const MAX_CIPHERTEXT_LENGTH = 1_500_000;
