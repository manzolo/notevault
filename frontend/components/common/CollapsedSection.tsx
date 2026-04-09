'use client';

import Button from '@/components/common/Button';

interface Props {
  icon: React.ReactNode;
  label: string;
  onAdd: () => void;
  addLabel: string;
  onAdd2?: () => void;
  addLabel2?: string;
}

export default function CollapsedSection({ icon, label, onAdd, addLabel, onAdd2, addLabel2 }: Props) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <span className="text-gray-400 dark:text-gray-500 shrink-0">{icon}</span>
      <span className="text-sm text-gray-400 dark:text-gray-500 flex-1 select-none">{label}</span>
      <Button variant="ghost" size="sm" onClick={onAdd}>
        {addLabel}
      </Button>
      {onAdd2 && addLabel2 && (
        <Button variant="ghost" size="sm" onClick={onAdd2}>
          {addLabel2}
        </Button>
      )}
    </div>
  );
}
