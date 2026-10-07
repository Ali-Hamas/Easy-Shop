import StorefrontExperience from "@/components/storefront/storefront-experience";
import "@/styles/commerce.css";
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string; slug: string }>;
  searchParams: Promise<{ productId?: string }>;
}) {
  const [{ subdomain, slug }, { productId }] = await Promise.all([
    params,
    searchParams,
  ]);
  return (
    <StorefrontExperience
      key={`${subdomain}/${slug}/${productId ?? ""}`}
      subdomain={subdomain}
      slug={slug}
      expectedId={productId}
    />
  );
}
