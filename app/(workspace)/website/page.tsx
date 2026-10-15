import WebsiteEditor from "@/components/website/website-editor";
export const metadata = { title: "Website" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return <WebsiteEditor initialContact={section === "contact"} />;
}
