import React, { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Search, X, Check } from 'lucide-react';

export interface SearchableSelectOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: SearchableSelectOption | null) => void;
  onEnterNext?: () => void;
  placeholder?: string;
  disabled?: boolean;
  onQuickAdd?: () => void;
  quickAddTitle?: string;
  style?: React.CSSProperties;
  emptyLabel?: string;
}

export interface SearchableSelectHandle {
  focus: () => void;
  select: () => void;
}

export const SearchableSelect = forwardRef<SearchableSelectHandle, SearchableSelectProps>(({
  options,
  value,
  onChange,
  onSelectOption,
  onEnterNext,
  placeholder = 'Type to search...',
  disabled = false,
  onQuickAdd,
  quickAddTitle = 'Quick Add',
  style,
  emptyLabel = '-- Select Option --'
}, ref) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      internalInputRef.current?.focus();
      internalInputRef.current?.select();
    },
    select: () => {
      internalInputRef.current?.select();
    }
  }));

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.id === value) || null;
  }, [options, value]);

  // Sync display text with selected option
  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label);
    } else {
      setQuery('');
    }
  }, [selectedOption]);

  // Filter options matching query
  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      opt =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedOption) {
          setQuery(selectedOption.label);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const handleSelect = (option: SearchableSelectOption | null, advance: boolean = false) => {
    if (option) {
      onChange(option.id);
      if (onSelectOption) onSelectOption(option);
      setQuery(option.label);
    } else {
      onChange('');
      if (onSelectOption) onSelectOption(null);
      setQuery('');
    }
    setIsOpen(false);

    if (advance && onEnterNext) {
      setTimeout(() => {
        onEnterNext();
      }, 30);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect(null, false);
    internalInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.findIndex(o => o.id === value) >= 0 ? filteredOptions.findIndex(o => o.id === value) : 0);
        return;
      }
      if (e.key === 'Tab') {
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
        return;
      }
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
        return;
      }
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex], true);
      } else if (isOpen && filteredOptions.length === 1) {
        handleSelect(filteredOptions[0], true);
      } else if (selectedOption) {
        // Option already selected and dropdown closed, advance to next field
        setIsOpen(false);
        if (onEnterNext) onEnterNext();
      } else if (isOpen && filteredOptions.length > 0) {
        handleSelect(filteredOptions[0], true);
      } else if (!isOpen) {
        if (onEnterNext) onEnterNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.label);
      }
    } else if (e.key === 'Tab') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex], false);
      }
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', gap: '6px', alignItems: 'center', ...style }}>
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
        <input
          ref={internalInputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onFocus={() => {
            setIsOpen(true);
            const idx = filteredOptions.findIndex(o => o.id === value);
            setHighlightedIndex(idx >= 0 ? idx : 0);
          }}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if (!e.target.value) {
              onChange('');
              if (onSelectOption) onSelectOption(null);
            }
          }}
          onKeyDown={handleKeyDown}
          className="input-text-clean"
          style={{
            width: '100%',
            height: '38px',
            paddingLeft: '32px',
            paddingRight: value ? '30px' : '10px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'text'
          }}
        />
        <Search
          size={16}
          color="#6B7280"
          style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              color: '#9CA3AF'
            }}
            title="Clear selection"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {onQuickAdd && (
        <button
          type="button"
          className="btn-quick-n"
          title={quickAddTitle}
          onClick={onQuickAdd}
        >
          N
        </button>
      )}

      {/* Dropdown suggestions list */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: onQuickAdd ? '40px' : 0,
            maxHeight: '240px',
            overflowY: 'auto',
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            zIndex: 9999
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#6B7280', fontSize: '0.88rem', fontWeight: 600, textAlign: 'center' }}>
              No matches found for "{query}".
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.id === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt, true)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #F3F4F6',
                    background: isHighlighted ? '#EFF6FF' : isSelected ? '#F5F3FF' : '#FFFFFF',
                    transition: 'background 0.1s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isSelected ? '#002B99' : '#111827' }}>
                      {opt.label}
                    </div>
                    {opt.subLabel && (
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                        {opt.subLabel}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {opt.badge && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: opt.badgeBg || '#E0E7FF',
                          color: opt.badgeColor || '#3730A3'
                        }}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check size={16} color="#002B99" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

SearchableSelect.displayName = 'SearchableSelect';
