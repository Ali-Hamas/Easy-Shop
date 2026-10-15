import type { ReactNode } from "react";
export type TableColumn<T> = {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
};
/** Pure presentation; sorting, selection and permissions belong to future feature callers. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  caption: string;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={c.numeric ? "numeric" : undefined}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td
                  key={c.id}
                  data-label={c.label}
                  className={c.numeric ? "numeric" : undefined}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
