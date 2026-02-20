import { useCallback } from "react";
import { getSignedUrl } from "@/utils/storageUtils";
import { toast } from "sonner";

/**
 * Opens a stored file URL in a new tab using a signed URL.
 * Handles both legacy full URLs and new "bucket:path" format.
 */
export async function openStorageFile(
  storedValue: string | null | undefined,
  defaultBucket?: string
): Promise<void> {
  if (!storedValue) return;

  try {
    const url = await getSignedUrl(storedValue, defaultBucket);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Could not access file");
    }
  } catch (error) {
    console.error("Error opening file:", error);
    toast.error("Could not access file");
  }
}

/**
 * React hook that returns a click handler for opening storage files.
 */
export function useOpenStorageFile() {
  return useCallback(
    (storedValue: string | null | undefined, defaultBucket?: string) => {
      openStorageFile(storedValue, defaultBucket);
    },
    []
  );
}
