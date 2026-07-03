import { useEffect, useRef, useState } from "react";
import { decode } from "blurhash";

interface Props {
  blurhash: string | null | undefined;
  src?: string | null;
  alt: string;
  className?: string;
}

/**
 * Renders the blurhash placeholder immediately (and permanently for photos
 * that have no URL yet, e.g. pending moderation), swapping in the real image
 * once it loads.
 */
export function BlurhashImage({ blurhash, src, alt, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !blurhash) return;
    try {
      const pixels = decode(blurhash, 32, 32);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(32, 32);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // invalid blurhash — leave the canvas blank
    }
  }, [blurhash]);

  return (
    <div className={`blurhash-frame ${className ?? ""}`}>
      <canvas ref={canvasRef} width={32} height={32} style={{ opacity: loaded ? 0 : 1 }} />
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
      {!src && !blurhash && <div className="blurhash-empty">{alt.slice(0, 1).toUpperCase()}</div>}
    </div>
  );
}
