/**
 * Client-Side PGM (Netpbm Portable Graymap) Decoder
 * Decodes P5 (binary) and P2 (ASCII) grayscale mammogram radiographs
 * directly in the browser to an HTML5 Canvas and JPEG/PNG Data URL.
 * Preserves native aspect ratio and dynamic range.
 */

export interface DecodedPgm {
  dataUrl: string;
  width: number;
  height: number;
  maxVal: number;
  format: 'P5' | 'P2';
}

export async function decodePgmImage(
  fileOrBlob: Blob,
  maxDisplayDim: number = 1024
): Promise<DecodedPgm> {
  const buffer = await fileOrBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let offset = 0;

  function readNextToken(): string {
    while (offset < bytes.length) {
      // Skip whitespace
      while (offset < bytes.length && bytes[offset] <= 32) {
        offset++;
      }
      if (offset >= bytes.length) break;

      // Skip comments starting with '#'
      if (bytes[offset] === 35) {
        while (offset < bytes.length && bytes[offset] !== 10 && bytes[offset] !== 13) {
          offset++;
        }
        continue;
      }

      // Read token characters
      const start = offset;
      while (offset < bytes.length && bytes[offset] > 32) {
        offset++;
      }
      const tokenSlice = bytes.subarray(start, offset);
      return new TextDecoder().decode(tokenSlice);
    }
    return '';
  }

  const magic = readNextToken();
  if (magic !== 'P5' && magic !== 'P2') {
    throw new Error(`Unsupported PGM format: '${magic}'. Expected 'P5' or 'P2'.`);
  }

  const widthStr = readNextToken();
  const heightStr = readNextToken();
  const maxValStr = readNextToken();

  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);
  const maxVal = parseInt(maxValStr, 10);

  if (!width || !height || width < 1 || height < 1 || !maxVal || maxVal < 1) {
    throw new Error('Invalid PGM header dimensions or maximum gray value.');
  }

  // The single whitespace character terminating maxVal
  if (offset < bytes.length && bytes[offset] <= 32) {
    offset++;
  }

  // Determine stride step to fit within maxDisplayDim while preserving aspect ratio
  const maxOriginalDim = Math.max(width, height);
  const step = Math.max(1, Math.floor(maxOriginalDim / maxDisplayDim));
  const outW = Math.max(1, Math.floor(width / step));
  const outH = Math.max(1, Math.floor(height / step));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for PGM radiograph rendering.');
  }

  const imgData = ctx.createImageData(outW, outH);
  const pixels = imgData.data;

  if (magic === 'P5') {
    const is16Bit = maxVal > 255;
    const bytesPerPixel = is16Bit ? 2 : 1;

    for (let y = 0; y < outH; y++) {
      const srcY = y * step;
      const rowOffset = offset + srcY * width * bytesPerPixel;

      for (let x = 0; x < outW; x++) {
        const srcX = x * step;
        const pxOffset = rowOffset + srcX * bytesPerPixel;
        let gray = 0;

        if (pxOffset < bytes.length) {
          if (is16Bit) {
            const raw16 = (bytes[pxOffset] << 8) | bytes[pxOffset + 1];
            gray = Math.min(255, Math.floor((raw16 / maxVal) * 255));
          } else {
            const raw8 = bytes[pxOffset];
            gray = maxVal === 255 ? raw8 : Math.min(255, Math.floor((raw8 / maxVal) * 255));
          }
        }

        const dst = (y * outW + x) * 4;
        pixels[dst] = gray;
        pixels[dst + 1] = gray;
        pixels[dst + 2] = gray;
        pixels[dst + 3] = 255;
      }
    }
  } else {
    // P2 ASCII parser
    let pixelCount = 0;
    const totalPixels = width * height;
    const fullGray = new Uint8Array(totalPixels);

    while (pixelCount < totalPixels && offset < bytes.length) {
      const token = readNextToken();
      if (!token) break;
      const rawVal = parseInt(token, 10);
      fullGray[pixelCount++] = Math.min(255, Math.floor((rawVal / maxVal) * 255));
    }

    for (let y = 0; y < outH; y++) {
      const srcY = y * step;
      for (let x = 0; x < outW; x++) {
        const srcX = x * step;
        const gray = fullGray[srcY * width + srcX] || 0;
        const dst = (y * outW + x) * 4;
        pixels[dst] = gray;
        pixels[dst + 1] = gray;
        pixels[dst + 2] = gray;
        pixels[dst + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  return {
    dataUrl,
    width,
    height,
    maxVal,
    format: magic as 'P5' | 'P2'
  };
}
