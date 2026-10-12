export type OrderLine = {
  productId: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: "new" | string;
  buyer: { name: string; phone: string; address: string; notes?: string };
  items: OrderLine[];
  currency: string;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  source: string;
  createdAt: string;
};
