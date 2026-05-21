import type { ReactNode } from "react";

type Props = {
  title: string;
  detail?: ReactNode;
};

export function EmptyState({ title, detail }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-fg mb-1">{title}</p>
        {detail && <p className="text-xs text-muted">{detail}</p>}
      </div>
    </div>
  );
}
