"use client";

import React, { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";
import { Compass, MapPin } from "lucide-react";

interface ImageWithFallbackProps extends Omit<ImageProps, "onError" | "onLoad"> {
  fallbackSrc?: string;
  containerClassName?: string;
  fallbackText?: string;
}

export default function ImageWithFallback({
  src,
  alt,
  fallbackSrc,
  containerClassName = "",
  className = "",
  fallbackText,
  ...props
}: ImageWithFallbackProps) {
  const isSrcValid = (s: any) => s && typeof s === "string" && s.trim().length > 0;

  const [imgSrc, setImgSrc] = useState<any>(src);
  const [loading, setLoading] = useState(Boolean(isSrcValid(src)));
  const [error, setError] = useState(false);

  // Sync state if source changes
  useEffect(() => {
    setImgSrc(src);
    setError(false);
    setLoading(Boolean(isSrcValid(src)));
  }, [src]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
      setLoading(true);
    } else {
      setError(true);
      setLoading(false);
    }
  };

  // Safe check if image source is valid string
  const hasValidSrc = imgSrc && typeof imgSrc === "string" && imgSrc.trim().length > 0;

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${props.fill ? "w-full h-full" : ""} ${containerClassName}`}>
      {/* SKELETON LOADER */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-tr from-[#FAF8F5] to-[#EAE6DB] animate-pulse">
          <Compass className="w-5 h-5 text-teal-600/40 animate-spin" style={{ animationDuration: "3s" }} />
        </div>
      )}

      {/* RENDER FALLBACK STYLED GRAPHIC ON EXPLICIT ERROR OR INVALID URL */}
      {error || !hasValidSrc ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gradient-to-tr from-[#F4F1E9] to-[#EAE6DB] border border-gray-200/40 select-none">
          <MapPin className="w-6 h-6 text-teal-600/60 mb-2 animate-bounce" />
          <span className="text-[10px] font-bold text-[#666059] uppercase tracking-wider line-clamp-1 max-w-[80%]">
            {fallbackText || alt || "Trip Location"}
          </span>
        </div>
      ) : (
        <Image
          src={imgSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-all duration-500 ease-in-out ${
 loading ? "scale-95 blur-sm opacity-60" : "scale-100 blur-0 opacity-100"
 } ${className}`}
          {...props}
        />
      )}
    </div>
  );
}
