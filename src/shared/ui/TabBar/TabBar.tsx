import tabStyles from '@/shared/styles/tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pill';
}

export function TabBar({
  tabs,
  activeId,
  onChange,
  className,
  variant = 'underline',
}: TabBarProps) {
  const barClass = variant === 'pill' ? tabStyles.pillBar : tabStyles.bar;
  const tabClass = variant === 'pill' ? tabStyles.pill : tabStyles.tab;
  const activeClass = variant === 'pill' ? tabStyles.pillActive : tabStyles.tabActive;

  return (
    <div className={`${barClass} ${className ?? ''}`} role="tablist">
      {tabs.map(tab => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${tabClass} ${isActive ? activeClass : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={tabStyles.count}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
