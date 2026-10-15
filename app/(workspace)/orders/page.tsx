import SellerOrders from "@/components/orders/seller-orders";
import { redirect } from "next/navigation";
import { commerceUi } from "@/config/commerce-ui";
export const metadata = { title: "Orders" };
export default function Page() {
  if (!commerceUi.orders) redirect("/dashboard");
  return <SellerOrders />;
}
