import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the bucket name and file path from a stored URL or path.
 * Handles both legacy full public URLs and new "bucket:path" format.
 */
function parseBucketAndPath(
  storedValue: string,
  defaultBucket?: string
): { bucket: string; path: string } | null {
  // New format: "bucket:path"
  const colonIdx = storedValue.indexOf(":");
  if (
    colonIdx > 0 &&
    !storedValue.startsWith("http") &&
    !storedValue.startsWith("/")
  ) {
    return {
      bucket: storedValue.substring(0, colonIdx),
      path: storedValue.substring(colonIdx + 1),
    };
  }

  // Legacy format: full Supabase public URL
  // e.g. https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.pdf
  const publicMatch = storedValue.match(
    /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/
  );
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }

  // If we have a default bucket and the value looks like a plain path
  if (defaultBucket && !storedValue.startsWith("http")) {
    return { bucket: defaultBucket, path: storedValue };
  }

  return null;
}

/**
 * Returns the storage path to persist in the database (format: "bucket:path").
 */
export function buildStoragePath(bucket: string, filePath: string): string {
  return `${bucket}:${filePath}`;
}

/**
 * Generates a signed URL for a stored file.
 * Accepts legacy full URLs, "bucket:path" format, or plain path with defaultBucket.
 * Returns the original value if it's an external URL (not Supabase storage).
 * 
 * @param storedValue - The value stored in the database
 * @param defaultBucket - Fallback bucket name if format is plain path
 * @param expiresIn - Signed URL expiry in seconds (default: 1 hour)
 */
export async function getSignedUrl(
  storedValue: string | null | undefined,
  defaultBucket?: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!storedValue) return null;

  const parsed = parseBucketAndPath(storedValue, defaultBucket);

  // If we can't parse it and it's an external URL, return as-is
  if (!parsed) {
    if (storedValue.startsWith("http")) return storedValue;
    return null;
  }

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    // Fallback: if it was an http URL, return it
    if (storedValue.startsWith("http")) return storedValue;
    return null;
  }

  return data.signedUrl;
}

/**
 * Generates signed URLs for an array of stored file values.
 */
export async function getSignedUrls(
  storedValues: string[] | null | undefined,
  defaultBucket?: string,
  expiresIn = 3600
): Promise<string[]> {
  if (!storedValues || storedValues.length === 0) return [];
  
  const results = await Promise.all(
    storedValues.map((v) => getSignedUrl(v, defaultBucket, expiresIn))
  );
  return results.filter((url): url is string => url !== null);
}
