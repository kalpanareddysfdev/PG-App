/**
 * Image compression and file utilities for Firestore storage
 *
 * Since Firebase Storage is on the paid Blaze plan, we store files
 * in Firestore as base64. These helpers manage compression and chunking.
 */

/**
 * Compress image to a target width and return as JPEG data URL
 * @param {File} file — image file
 * @param {number} targetWidth — target width in pixels (default 256)
 * @param {number} quality — JPEG quality 0-1 (default 0.8)
 * @returns {Promise<string>} — data URL
 */
export async function compressImage(file, targetWidth = 256, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = targetWidth / img.width;
        canvas.width = targetWidth;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a thumbnail (64px) for lists/previews
 * @param {File} file — image file
 * @returns {Promise<string>} — data URL
 */
export async function createThumbnail(file) {
  return compressImage(file, 64, 0.7);
}

/**
 * Split base64 string into chunks for Firestore
 * Firestore documents are limited to ~1 MiB. Base64 is ~33% larger than binary,
 * so we chunk at 400KB base64 = ~300KB binary.
 *
 * @param {string} base64 — base64 string (with data URL prefix like "data:image/jpeg;base64,")
 * @param {number} chunkSize — chunk size in bytes (default 400KB)
 * @returns {Array<string>} — array of base64 chunks
 */
export function chunkBase64(base64, chunkSize = 400000) {
  // Extract the base64 content (after the comma if it's a data URL)
  const base64Content = base64.includes(',') ? base64.split(',')[1] : base64;
  const chunks = [];

  for (let i = 0; i < base64Content.length; i += chunkSize) {
    chunks.push(base64Content.substring(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Reassemble base64 chunks
 * @param {Array<string>} chunks — array of base64 strings
 * @returns {string} — full base64 string
 */
export function reassembleBase64(chunks) {
  return chunks.join('');
}

/**
 * Validate file for upload
 * @param {File} file — file to validate
 * @param {Object} options — { maxSize (bytes), allowedTypes (array) }
 * @returns {Object} — { valid: boolean, error?: string }
 */
export function validateFile(file, options = {}) {
  const {
    maxSize = 1024 * 1024, // 1 MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  } = options;

  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File is too large (max ${maxMB}MB)` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Get MIME type from file or data URL
 * @param {File | string} fileOrUrl — file or data URL
 * @returns {string} — MIME type
 */
export function getMimeType(fileOrUrl) {
  if (fileOrUrl instanceof File) {
    return fileOrUrl.type;
  }

  // Extract from data URL
  const match = fileOrUrl.match(/data:([^;]+)/);
  return match ? match[1] : 'application/octet-stream';
}

/**
 * Estimate Firestore storage cost of a file
 * @param {File} file — file
 * @returns {Object} — { bytes, estimatedWrites, estimatedReads }
 */
export function estimateFirestoreCost(file) {
  const base64Size = Math.ceil(file.size * 4 / 3); // base64 overhead
  const chunks = Math.ceil(base64Size / 400000);

  return {
    bytes: base64Size,
    chunks,
    estimatedWrites: chunks + 1, // Each chunk + metadata doc write
    estimatedReads: chunks // Reading back requires fetching each chunk
  };
}

/**
 * Format file size for display
 * @param {number} bytes — file size in bytes
 * @returns {string} — formatted size (e.g. "2.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
