import type { ReactNode } from "react";

type Props = {
  title: string;
  detail?: ReactNode;
};

export function EmptyState({ title, detail }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-gray-700 mb-1">{title}</p>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
      </div>
    </div>
  );
}
