import StorefrontExperience from "@/components/storefront/storefront-experience";
import "@/styles/commerce.css";
export default async function StorePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  return <StorefrontExperience key={subdomain} subdomain={subdomain} />;
}
