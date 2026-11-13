import { Helmet } from 'react-helmet-async';
import { SITE } from '@/config/site';

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

export function Seo({ title, description = SITE.description, path = '/', noindex, jsonLd }: SeoProps) {
  const fullTitle = title ? `${title} · PinDeleter` : `PinDeleter — bulk-delete your Pinterest pins safely`;
  const url = `${SITE.url}${path}`;
  const image = `${SITE.url}/og-image.png`;
  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.fullName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
