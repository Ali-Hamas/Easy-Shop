export interface AiContextProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  inStock: boolean;
  availableQuantity: number;
  variants: Array<{
    id: string;
    name: string;
    sku?: string;
    price?: number;
    availableQuantity: number;
    inStock: boolean;
  }>;
}

export interface AiContextCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  language: string;
  tags: string[];
  staffNotes: string[];
}

export interface AiContextInput {
  shopId: string;
  customer: AiContextCustomer;
  latestCustomerMessage: string;
  conversationHistory: Array<{
    sender: "customer" | "staff";
    text: string;
    createdAt: string;
  }>;
  relevantProducts: AiContextProduct[];
  channel: string;
}

export interface AiReplyOutput {
  provider?: "openai" | "fallback";
  replyText: string;
  confidence: "high" | "review" | "missing";
  groundingSummary: string;
  needsHumanAttention: boolean;
  escalationReason?: string;
  contextSources: Array<{
    type: "customer" | "product" | "inventory" | "staff_note" | "policy";
    name: string;
    detail?: string;
  }>;
}

export interface AiReplyProvider {
  generateReply(context: AiContextInput): Promise<AiReplyOutput>;
}

/** Conservative fallback: never claims facts or policies that were not supplied. */
export class GroundedRuleAiProvider implements AiReplyProvider {
  async generateReply(context: AiContextInput): Promise<AiReplyOutput> {
    const bn = context.customer.language === "bn";
    const product =
      context.relevantProducts.length === 1
        ? context.relevantProducts[0]
        : null;
    const sensitive =
      /deliver|refund|return|complaint|damaged|discount|order|ডেলিভারি|ফেরত|অর্ডার|নষ্ট/i.test(
        context.latestCustomerMessage,
      );
    const sources: AiReplyOutput["contextSources"] = [];
    let replyText = bn
      ? "আপনি কোন পণ্য বা তথ্য সম্পর্কে জানতে চান? পণ্যের নাম বা লিংক পাঠাতে পারেন।"
      : "Which product or detail would you like help with? Please share the product name or link.";
    if (sensitive)
      replyText = bn
        ? "আপনার প্রশ্নটি বুঝতে পেরেছি। সঠিক তথ্য দেওয়ার আগে বিষয়টি যাচাই করা প্রয়োজন।"
        : "Thank you for explaining. This needs to be checked before we can give you a confirmed answer.";
    else if (product && Number.isFinite(product.price)) {
      replyText = bn
        ? `${product.name}: মূল্য ${product.currency} ${product.price}। ${product.inStock ? "বর্তমানে স্টকে আছে।" : "বর্তমানে স্টকে নেই।"}`
        : `${product.name} is listed at ${product.currency} ${product.price}. It is currently ${product.inStock ? "in stock" : "out of stock"}.`;
      sources.push(
        {
          type: "product",
          name: product.name,
          detail: `${product.currency} ${product.price}`,
        },
        {
          type: "inventory",
          name: "Available stock",
          detail: String(product.availableQuantity),
        },
      );
    }
    return {
      replyText,
      confidence: "review",
      groundingSummary:
        "Conservative fallback draft. Review the question, current facts and language before approval.",
      needsHumanAttention: true,
      escalationReason:
        "Human review required; no unsupported policies or promises have been supplied.",
      contextSources: sources,
      provider: "fallback",
    };
  }
}
export {
  OpenAiReplyProvider,
  type OpenAiReplyProviderOptions,
} from "./openai-provider.js";
