import { ChevronDown, Check, ArrowUpDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getSubjectAcronym } from './assignmentUtils';

export type Filter = 'all' | 'pending' | 'submitted' | 'overdue' | 'archived';

interface AssignmentFiltersProps {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  selectedSubject: string;
  onSubjectChange: (subj: string) => void;
  uniqueSubjects: string[];
  subjectCounts: Record<string, number>;
  statusFilteredCount: number;
  sortBy: 'due' | 'created';
  onSortByChange: (sortBy: 'due' | 'created') => void;
}

export function AssignmentFilters({
  filter,
  onFilterChange,
  selectedSubject,
  onSubjectChange,
  uniqueSubjects,
  subjectCounts,
  statusFilteredCount,
  sortBy,
  onSortByChange,
}: AssignmentFiltersProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 0', gap: 12 }}>
      {/* Status Dropdown Filter */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="filter-tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              padding: '0 14px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              height: '38px',
              userSelect: 'none',
            }}
          >
            <span style={{ textTransform: 'capitalize' }}>
              {filter === 'all' ? 'All' : filter === 'archived' ? 'Archived & Expired' : filter}
            </span>
            <ChevronDown size={14} style={{ opacity: 0.6 }} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="dropdown-content animate-slide-up"
            style={{ zIndex: 10000, minWidth: '180px' }}
          >
            {(['all', 'pending', 'submitted', 'overdue', 'archived'] as Filter[]).map(f => {
              const isSelected = filter === f;
              return (
                <DropdownMenu.Item
                  key={f}
                  onClick={() => onFilterChange(f)}
                  className="dropdown-item"
                  style={{
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                    fontWeight: isSelected ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    textTransform: 'capitalize',
                  }}
                >
                  <span>{f === 'all' ? 'All Assignments' : f === 'archived' ? 'Archived & Expired' : f}</span>
                  {isSelected && <Check size={14} />}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Right Filters Container */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Subject Dropdown Selector */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-pill)',
                padding: '0 14px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                height: '38px',
                maxWidth: '160px',
                userSelect: 'none',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedSubject === 'all' ? 'All Subjects' : getSubjectAcronym(selectedSubject)}
              </span>
              <ChevronDown size={14} style={{ opacity: 0.6 }} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="dropdown-content animate-slide-up no-scrollbar"
              style={{ zIndex: 10000, minWidth: '220px', maxWidth: '300px', maxHeight: '300px', overflowY: 'auto' }}
            >
              <DropdownMenu.Item
                onClick={() => onSubjectChange('all')}
                className="dropdown-item"
                style={{
                  color: selectedSubject === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: selectedSubject === 'all' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                  fontWeight: selectedSubject === 'all' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>All Subjects</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="t-mono-sm" style={{ opacity: 0.6, fontSize: '12px' }}>
                    {statusFilteredCount}
                  </span>
                  {selectedSubject === 'all' && <Check size={14} />}
                </div>
              </DropdownMenu.Item>

              {uniqueSubjects.map(subj => {
                const isSelected = selectedSubject === subj;
                const count = subjectCounts[subj];
                return (
                  <DropdownMenu.Item
                    key={subj}
                    onClick={() => onSubjectChange(subj)}
                    className="dropdown-item"
                    style={{
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                      fontWeight: isSelected ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                      {subj}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className="t-mono-sm" style={{ opacity: 0.6, fontSize: '12px' }}>
                        {count}
                      </span>
                      {isSelected && <Check size={14} />}
                    </div>
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Sort Dropdown Selector */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                height: '38px',
                userSelect: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <ArrowUpDown size={14} color="var(--accent-primary)" />
              <span>Sort: {sortBy === 'due' ? 'Due' : 'Created'}</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="dropdown-content animate-slide-up"
              style={{ zIndex: 10000, minWidth: '150px' }}
            >
              <DropdownMenu.Item
                onClick={() => onSortByChange('due')}
                className="dropdown-item"
                style={{
                  color: sortBy === 'due' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: sortBy === 'due' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                  fontWeight: sortBy === 'due' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>Due Date</span>
                {sortBy === 'due' && <Check size={14} />}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => onSortByChange('created')}
                className="dropdown-item"
                style={{
                  color: sortBy === 'created' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: sortBy === 'created' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                  fontWeight: sortBy === 'created' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>Date Created</span>
                {sortBy === 'created' && <Check size={14} />}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
