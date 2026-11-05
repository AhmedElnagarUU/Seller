import Image from "next/image";

type ImageFrameProps = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
};

// A 4:3 box that fills with an image and crops it to fit.
export function ImageFrame({ src, alt, sizes, priority = false }: ImageFrameProps) {
  return (
    <div className="bg-surface relative aspect-4/3 w-full overflow-hidden rounded-md">
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
