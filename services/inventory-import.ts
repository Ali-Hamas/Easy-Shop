/** Explicit future boundary: no file is uploaded and no rows are written. */
export type ImportStage =
  "upload" | "mapping" | "validation" | "preview" | "confirmation" | "result";
export type ImportRowIssue = { row: number; column: string; message: string };
export interface InventoryImportService {
  validate(
    file: File,
    mapping: Record<string, string>,
  ): Promise<{ rows: number; issues: ImportRowIssue[] }>;
  confirm(previewId: string): Promise<{ created: number; updated: number }>;
}
export const inventoryImportAvailability = {
  enabled: false,
  reason: "Bulk import writes and duplicate-SKU resolution are deferred.",
} as const;
