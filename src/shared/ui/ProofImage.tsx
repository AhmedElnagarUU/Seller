import Image from "next/image";

type ProofImageProps = {
  src: string;
  alt: string;
};

// A screenshot from a signed URL. `unoptimized`: the host of a signed URL is not in `remotePatterns`.
export function ProofImage({ src, alt }: ProofImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={1200}
      unoptimized
      className="border-border h-auto w-full rounded-md border"
    />
  );
}
