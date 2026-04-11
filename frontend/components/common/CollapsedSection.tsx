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
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20 hover:border-gray-300 dark:hover:border-gray-600 transition-colors group">
      <span className="text-gray-300 dark:text-gray-600 shrink-0 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors">{icon}</span>
      <span className="text-sm text-gray-400 dark:text-gray-500 flex-1 select-none">{label}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onAdd} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          {addLabel}
        </Button>
        {onAdd2 && addLabel2 && (
          <Button variant="ghost" size="sm" onClick={onAdd2} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            {addLabel2}
          </Button>
        )}
      </div>
    </div>
  );
}
