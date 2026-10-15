import type { Metadata } from "next";
import CommerceLaunch from "@/components/public/commerce-launch";
import "@/styles/launch.css";
import "@/styles/studio.css";
import "@/styles/inventory.css";
import "@/styles/customer-motion.css";
import "@/styles/connected-opening.css";
export const metadata: Metadata = {
  title: { absolute: "Easy Shop — Your shop, in every conversation" },
  description:
    "A connected working space for social sellers. Products, people and supervised AI replies.",
};
export default function Home() {
  return <CommerceLaunch />;
}
