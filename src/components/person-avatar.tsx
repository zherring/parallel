import { tmdbImage, type ImageSize } from "@/lib/images";
import { initials } from "@/lib/person-labels";

interface Props {
  name: string;
  profilePath: string | null;
  /** Pixel diameter. */
  size?: number;
  imageSize?: ImageSize;
  className?: string;
}

/**
 * Round profile photo with an initials fallback underneath: if the image is missing or fails to
 * load, the initials show. Decorative (aria-hidden): callers always render the name beside it.
 */
export function PersonAvatar({ name, profilePath, size = 40, imageSize = "w92", className }: Props) {
  const src = tmdbImage(profilePath, imageSize);
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-border font-medium text-muted ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
      {src && (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
