import type { Metadata } from "next";

type PageMetadataInput = {
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
  images?: NonNullable<Metadata["openGraph"]>["images"];
};

export function createPageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
  images,
}: PageMetadataInput): Metadata {
  const openGraphTitle = absoluteTitle ? title : `${title} | Macas Moon Glamping`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: openGraphTitle,
      description,
      url: path,
      ...(images ? { images } : {}),
    },
  };
}
