import type { InventoryInput } from "@/types/inventory";

export type ProductFieldError = {
  fieldKey: string;
  inputId: string;
  sectionIndex: number;
  sectionName: string;
  message: string;
};

export type ProductValidationResult = {
  isValid: boolean;
  errors: Record<string, ProductFieldError>;
  sectionErrors: Record<number, number>;
  firstError: ProductFieldError | null;
  summaryMessage: string | null;
};

export const PRODUCT_SECTIONS = [
  "Basics",
  "Media",
  "Pricing",
  "Variants & stock",
] as const;

export function sanitizePath(path: (string | number)[]): string[] {
  // Strip outer wrappers if present (e.g. ["product", "name"] -> ["name"])
  const normalized = path.map(String);
  if (normalized[0] === "product") {
    return normalized.slice(1);
  }
  return normalized;
}

export function humanizeProductError(
  pathParts: (string | number)[],
  rawMessage: string,
): {
  sectionIndex: number;
  fieldKey: string;
  inputId: string;
  message: string;
} {
  const parts = sanitizePath(pathParts);
  const first = parts[0] ?? "";
  const lowerMsg = (rawMessage || "").toLowerCase();

  // 0. Basics
  if (first === "name") {
    return {
      sectionIndex: 0,
      fieldKey: "name",
      inputId: "field-product-name",
      message: "Product name is required (1–180 characters).",
    };
  }
  if (first === "sku") {
    return {
      sectionIndex: 0,
      fieldKey: "sku",
      inputId: "field-product-sku",
      message: "Product SKU must be 80 characters or fewer.",
    };
  }
  if (first === "category") {
    return {
      sectionIndex: 0,
      fieldKey: "category",
      inputId: "field-product-category",
      message: "Category cannot exceed 100 characters.",
    };
  }
  if (first === "description") {
    return {
      sectionIndex: 0,
      fieldKey: "description",
      inputId: "field-product-description",
      message: "Description cannot exceed 5000 characters.",
    };
  }
  if (first === "status") {
    return {
      sectionIndex: 0,
      fieldKey: "status",
      inputId: "field-product-status",
      message: "Select a valid product status.",
    };
  }

  // 1. Media
  if (first === "images") {
    const idx = parts[1];
    return {
      sectionIndex: 1,
      fieldKey: "images",
      inputId:
        typeof idx !== "undefined"
          ? `field-product-image-${idx}`
          : "field-product-image-0",
      message:
        typeof idx !== "undefined"
          ? `Image #${Number(idx) + 1} must be a valid uploaded file or HTTP/HTTPS address.`
          : "Main product image is required (upload up to 10 images).",
    };
  }

  // 2. Pricing
  if (first === "price") {
    return {
      sectionIndex: 2,
      fieldKey: "price",
      inputId: "field-product-price",
      message: "Enter a valid selling price greater than 0.",
    };
  }
  if (first === "comparePrice") {
    return {
      sectionIndex: 2,
      fieldKey: "comparePrice",
      inputId: "field-product-comparePrice",
      message:
        lowerMsg.includes("below") || lowerMsg.includes("less")
          ? "Compare price must be greater than or equal to selling price."
          : "Enter a valid compare price amount.",
    };
  }
  if (first === "cost") {
    return {
      sectionIndex: 2,
      fieldKey: "cost",
      inputId: "field-product-cost",
      message: "Enter a valid cost amount (0 or more).",
    };
  }

  // 3. Variants & Stock
  if (first === "variants") {
    const vIndex = typeof parts[1] === "number" ? parts[1] : Number(parts[1]);
    const vField = parts[2];

    if (isNaN(vIndex)) {
      return {
        sectionIndex: 3,
        fieldKey: "variants",
        inputId: "field-variant-0-sku",
        message: lowerMsg.includes("unique")
          ? "Each variant must have a unique SKU."
          : "At least one variant is required.",
      };
    }

    if (vField === "sku") {
      return {
        sectionIndex: 3,
        fieldKey: `variant-${vIndex}-sku`,
        inputId: `field-variant-${vIndex}-sku`,
        message: `Variant ${vIndex + 1} SKU must be 80 characters or fewer.`,
      };
    }
    if (vField === "title") {
      return {
        sectionIndex: 3,
        fieldKey: `variant-${vIndex}-title`,
        inputId: `field-variant-${vIndex}-title`,
        message: `Variant ${vIndex + 1} name is required.`,
      };
    }
    if (vField === "openingStock") {
      return {
        sectionIndex: 3,
        fieldKey: `variant-${vIndex}-openingStock`,
        inputId: `field-variant-${vIndex}-openingStock`,
        message: `Variant ${vIndex + 1} opening stock must be 0 or more.`,
      };
    }
    if (vField === "lowStockThreshold") {
      return {
        sectionIndex: 3,
        fieldKey: `variant-${vIndex}-lowStockThreshold`,
        inputId: `field-variant-${vIndex}-lowStockThreshold`,
        message: `Variant ${vIndex + 1} low-stock alert threshold must be 0 or more.`,
      };
    }
    if (vField === "priceOverride") {
      return {
        sectionIndex: 3,
        fieldKey: `variant-${vIndex}-priceOverride`,
        inputId: `field-variant-${vIndex}-priceOverride`,
        message: `Variant ${vIndex + 1} price override must be a positive number.`,
      };
    }
    if (vField === "image") {
      return {
        sectionIndex: 3,
        fieldKey: `variant-${vIndex}-image`,
        inputId: `field-variant-${vIndex}-image`,
        message: `Variant ${vIndex + 1} image must be a valid HTTP/HTTPS URL.`,
      };
    }

    return {
      sectionIndex: 3,
      fieldKey: `variant-${vIndex}`,
      inputId: `field-variant-${vIndex}-title`,
      message: `Variant ${vIndex + 1} has invalid details.`,
    };
  }

  // 4. Hidden delivery and SEO fields kept for older saved products.
  if (first === "delivery") {
    const sub = parts[1];
    if (sub === "weightGrams") {
      return {
        sectionIndex: 0,
        fieldKey: "delivery-weightGrams",
        inputId: "field-delivery-weightGrams",
        message: "Weight must be 0 or more grams.",
      };
    }
    return {
      sectionIndex: 0,
      fieldKey: "delivery-note",
      inputId: "field-delivery-note",
      message: "Delivery notes cannot exceed 5000 characters.",
    };
  }

  if (first === "seo") {
    const sub = parts[1];
    if (sub === "title") {
      return {
        sectionIndex: 0,
        fieldKey: "seo-title",
        inputId: "field-seo-title",
        message: "SEO title cannot exceed 160 characters.",
      };
    }
    return {
      sectionIndex: 0,
      fieldKey: "seo-description",
      inputId: "field-seo-description",
      message: "SEO description cannot exceed 320 characters.",
    };
  }

  // Fallback
  return {
    sectionIndex: 0,
    fieldKey: first || "general",
    inputId: "field-product-name",
    message: rawMessage || "Please check this value.",
  };
}

export function mapBackendIssuesToErrors(
  issues?: Array<{ path: (string | number)[]; message: string; code?: string }>,
): ProductValidationResult {
  const errors: Record<string, ProductFieldError> = {};
  const sectionErrors: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
  };
  let firstError: ProductFieldError | null = null;

  if (issues && issues.length > 0) {
    for (const issue of issues) {
      const mapped = humanizeProductError(issue.path, issue.message);
      const fieldError: ProductFieldError = {
        fieldKey: mapped.fieldKey,
        inputId: mapped.inputId,
        sectionIndex: mapped.sectionIndex,
        sectionName: PRODUCT_SECTIONS[mapped.sectionIndex],
        message: mapped.message,
      };

      if (!errors[mapped.fieldKey]) {
        errors[mapped.fieldKey] = fieldError;
        sectionErrors[mapped.sectionIndex] =
          (sectionErrors[mapped.sectionIndex] || 0) + 1;
        if (!firstError) {
          firstError = fieldError;
        }
      }
    }
  }

  const count = Object.keys(errors).length;
  const summaryMessage =
    count > 0
      ? `${count} ${count === 1 ? "field needs" : "fields need"} attention before this product can be saved.`
      : null;

  return {
    isValid: count === 0,
    errors,
    sectionErrors,
    firstError,
    summaryMessage,
  };
}

export function validateProductDraft(
  draft: InventoryInput,
  mediaUrls: string | string[],
): ProductValidationResult {
  const errors: Record<string, ProductFieldError> = {};
  const sectionErrors: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
  };
  let firstError: ProductFieldError | null = null;

  function addError(
    sectionIndex: number,
    fieldKey: string,
    inputId: string,
    message: string,
  ) {
    if (errors[fieldKey]) return;
    const fe: ProductFieldError = {
      fieldKey,
      inputId,
      sectionIndex,
      sectionName: PRODUCT_SECTIONS[sectionIndex],
      message,
    };
    errors[fieldKey] = fe;
    sectionErrors[sectionIndex] = (sectionErrors[sectionIndex] || 0) + 1;
    if (!firstError) {
      firstError = fe;
    }
  }

  // 0. Basics
  if (!draft.name || draft.name.trim().length === 0) {
    addError(0, "name", "field-product-name", "Product name is required.");
  } else if (draft.name.trim().length > 180) {
    addError(
      0,
      "name",
      "field-product-name",
      "Product name must be 180 characters or fewer.",
    );
  }

  if (draft.sku && draft.sku.trim().length > 80) {
    addError(
      0,
      "sku",
      "field-product-sku",
      "Product SKU must be 80 characters or fewer.",
    );
  }

  if (draft.category && draft.category.trim().length > 100) {
    addError(
      0,
      "category",
      "field-product-category",
      "Category cannot exceed 100 characters.",
    );
  }

  if (draft.description && draft.description.trim().length > 5000) {
    addError(
      0,
      "description",
      "field-product-description",
      "Description cannot exceed 5000 characters.",
    );
  }

  // 1. Media: 1 image is mandatory, up to 10 images total allowed
  const rawLines: string[] = Array.isArray(mediaUrls)
    ? mediaUrls.map((l) => (typeof l === "string" ? l.trim() : ""))
    : mediaUrls.split("\n").map((l) => l.trim());
  const validImages = rawLines.filter(Boolean);

  if (!rawLines[0] || validImages.length === 0) {
    addError(
      1,
      "images",
      "field-product-image-0",
      "Main product image is required. Upload an image file or paste an image URL.",
    );
  } else if (validImages.length > 10) {
    addError(
      1,
      "images",
      "field-product-image-0",
      "You can add up to 10 product images.",
    );
  } else {
    for (let i = 0; i < validImages.length; i++) {
      const line = validImages[i];
      const isValid =
        /^https?:\/\//i.test(line) ||
        line.startsWith("data:image/") ||
        line.startsWith("/uploads/");
      if (!isValid) {
        addError(
          1,
          "images",
          `field-product-image-${i}`,
          `Image #${i + 1} must be an uploaded image file or start with http:// or https://.`,
        );
        break;
      }
    }
  }

  // 2. Pricing
  if (
    draft.price === undefined ||
    draft.price === null ||
    isNaN(Number(draft.price)) ||
    Number(draft.price) <= 0
  ) {
    addError(
      2,
      "price",
      "field-product-price",
      "Enter a valid selling price greater than 0.",
    );
  }

  if (draft.comparePrice !== null && draft.comparePrice !== undefined) {
    const comp = Number(draft.comparePrice);
    const pr = Number(draft.price);
    if (isNaN(comp) || comp < 0) {
      addError(
        2,
        "comparePrice",
        "field-product-comparePrice",
        "Enter a valid compare price.",
      );
    } else if (!isNaN(pr) && comp < pr) {
      addError(
        2,
        "comparePrice",
        "field-product-comparePrice",
        "Compare price must be greater than or equal to selling price.",
      );
    }
  }

  if (draft.cost !== null && draft.cost !== undefined) {
    const costNum = Number(draft.cost);
    if (isNaN(costNum) || costNum < 0) {
      addError(2, "cost", "field-product-cost", "Cost cannot be negative.");
    }
  }

  // 3. Variants
  if (!draft.variants || draft.variants.length === 0) {
    addError(
      3,
      "variants",
      "field-variant-0-sku",
      "At least one variant is required.",
    );
  } else {
    const seenSkus = new Set<string>();
    draft.variants.forEach((v, idx) => {
      if (!v.title || v.title.trim().length === 0) {
        addError(
          3,
          `variant-${idx}-title`,
          `field-variant-${idx}-title`,
          `Variant ${idx + 1} name is required.`,
        );
      }
      const vSku = (v.sku || "").trim().toUpperCase();
      if (vSku && seenSkus.has(vSku)) {
        addError(
          3,
          `variant-${idx}-sku`,
          `field-variant-${idx}-sku`,
          `Variant SKU "${vSku}" is duplicated. Each variant SKU must be unique.`,
        );
      } else {
        if (vSku) seenSkus.add(vSku);
      }

      if (v.openingStock !== undefined && v.openingStock !== null) {
        const stockNum = Number(v.openingStock);
        if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
          addError(
            3,
            `variant-${idx}-openingStock`,
            `field-variant-${idx}-openingStock`,
            `Variant ${idx + 1} opening stock must be 0 or more.`,
          );
        }
      }

      if (v.lowStockThreshold !== undefined && v.lowStockThreshold !== null) {
        const threshNum = Number(v.lowStockThreshold);
        if (isNaN(threshNum) || threshNum < 0) {
          addError(
            3,
            `variant-${idx}-lowStockThreshold`,
            `field-variant-${idx}-lowStockThreshold`,
            `Variant ${idx + 1} low-stock threshold must be 0 or more.`,
          );
        }
      }

      if (v.priceOverride !== undefined && v.priceOverride !== null) {
        const poNum = Number(v.priceOverride);
        if (isNaN(poNum) || poNum < 0) {
          addError(
            3,
            `variant-${idx}-priceOverride`,
            `field-variant-${idx}-priceOverride`,
            `Variant ${idx + 1} price override must be 0 or more.`,
          );
        }
      }

      if (
        v.image &&
        v.image.trim().length > 0 &&
        !/^https?:\/\//i.test(v.image.trim())
      ) {
        addError(
          3,
          `variant-${idx}-image`,
          `field-variant-${idx}-image`,
          `Variant ${idx + 1} image must start with http:// or https://.`,
        );
      }
    });
  }

  // 4. Delivery & SEO
  if (
    draft.delivery?.weightGrams !== null &&
    draft.delivery?.weightGrams !== undefined
  ) {
    const wt = Number(draft.delivery.weightGrams);
    if (isNaN(wt) || wt < 0) {
      addError(
        4,
        "delivery-weightGrams",
        "field-delivery-weightGrams",
        "Weight cannot be negative.",
      );
    }
  }

  if (draft.delivery?.note && draft.delivery.note.length > 5000) {
    addError(
      4,
      "delivery-note",
      "field-delivery-note",
      "Delivery note cannot exceed 5000 characters.",
    );
  }

  if (draft.seo?.title && draft.seo.title.length > 160) {
    addError(
      4,
      "seo-title",
      "field-seo-title",
      "SEO title cannot exceed 160 characters.",
    );
  }

  if (draft.seo?.description && draft.seo.description.length > 320) {
    addError(
      4,
      "seo-description",
      "field-seo-description",
      "SEO description cannot exceed 320 characters.",
    );
  }

  const count = Object.keys(errors).length;
  const summaryMessage =
    count > 0
      ? `${count} ${count === 1 ? "field needs" : "fields need"} attention before this product can be saved.`
      : null;

  return {
    isValid: count === 0,
    errors,
    sectionErrors,
    firstError,
    summaryMessage,
  };
}

export function validateOnboardingFirstProduct(
  name: string,
  price: string | number,
  stock: string | number,
): {
  isValid: boolean;
  errors: Record<string, string>;
  firstField: string | null;
} {
  const errors: Record<string, string> = {};
  let firstField: string | null = null;

  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    errors.productName = "Product name is required.";
    firstField = firstField ?? "productName";
  } else if (trimmedName.length < 2) {
    errors.productName = "Product name must contain at least 2 characters.";
    firstField = firstField ?? "productName";
  } else if (trimmedName.length > 160) {
    errors.productName = "Product name cannot exceed 160 characters.";
    firstField = firstField ?? "productName";
  }

  const priceNum = Number(price);
  if (price === "" || price === undefined || isNaN(priceNum) || priceNum <= 0) {
    errors.price = "Enter a valid price greater than 0.";
    firstField = firstField ?? "price";
  } else if (priceNum > 100000000) {
    errors.price = "Price exceeds maximum allowable amount.";
    firstField = firstField ?? "price";
  }

  const stockNum = Number(stock);
  if (
    stock === "" ||
    stock === undefined ||
    isNaN(stockNum) ||
    stockNum < 0 ||
    !Number.isInteger(stockNum)
  ) {
    errors.stock = "Enter a valid opening stock of 0 or more.";
    firstField = firstField ?? "stock";
  } else if (stockNum > 1000000) {
    errors.stock = "Opening stock cannot exceed 1,000,000 units.";
    firstField = firstField ?? "stock";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstField,
  };
}
