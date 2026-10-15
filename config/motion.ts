export const duration = {
  micro: 0.15,
  normal: 0.2,
  overlay: 0.28,
  page: 0.3,
} as const;
export const ease = [0.22, 1, 0.36, 1] as const;
export const reveal = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
};
