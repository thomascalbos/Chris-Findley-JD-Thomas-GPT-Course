// Screens with their own address (/alerts and so on); every other screen lives at /.
// Kept out of cinematch.tsx because server pages can't import values from a 'use client' file.
export const URL_VIEWS = ["tutorial", "trending", "alerts", "history"] as const;
