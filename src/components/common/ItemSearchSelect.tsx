import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Item } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { Search, X, Check } from 'lucide-react';

export interface ItemSearchSelectProps {
  items: Item[];
  selectedItemId: string;
  onSelectItem?: (item: Item | null) => void;
  onSelect?: (itemId: string) => void;
  onQuickAdd?: () => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const ItemSearchSelect: React.FC<ItemSearchSelectProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  onSelect,
  onQuickAdd,
  placeholder = 'Type to search item...',
  disabled = false,
  style
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(() => {
    return items.find(i => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Sync display text with selected item
  useEffect(() => {
    if (selectedItem) {
      setQuery(selectedItem.name);
    } else {
      setQuery('');
    }
  }, [selectedItem]);

  // Filter items matching query
  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
    );
  }, [items, query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If query doesn't match selected, restore selected name or clear
        if (selectedItem) {
          setQuery(selectedItem.name);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedItem]);

  const handleSelect = (item: Item) => {
    if (onSelectItem) onSelectItem(item);
    if (onSelect) onSelect(item.id);
    setQuery(item.name);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectItem) onSelectItem(null);
    if (onSelect) onSelect('');
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        handleSelect(filteredItems[highlightedIndex]);
      } else if (filteredItems.length === 1) {
        handleSelect(filteredItems[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', gap: '6px', alignItems: 'center', ...style }}>
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if (!e.target.value) {
              if (onSelectItem) onSelectItem(null);
              if (onSelect) onSelect('');
            }
          }}
          onKeyDown={handleKeyDown}
          className="input-text-clean"
          style={{
            width: '100%',
            height: '38px',
            paddingLeft: '32px',
            paddingRight: selectedItemId ? '30px' : '10px',
            fontSize: '0.95rem',
            fontWeight: 800,
            cursor: disabled ? 'not-allowed' : 'text'
          }}
        />
        <Search
          size={16}
          color="#6B7280"
          style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}
        />
        {selectedItemId && !disabled && (
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
            title="Clear item selection"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {onQuickAdd && (
        <button
          type="button"
          className="btn-quick-n"
          title="Quick Create Item"
          onClick={onQuickAdd}
        >
          N
        </button>
      )}

      {/* Floating Dropdown List */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: onQuickAdd ? '40px' : 0,
            maxHeight: '260px',
            overflowY: 'auto',
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            zIndex: 9999
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#6B7280', fontSize: '0.88rem', fontWeight: 600, textAlign: 'center' }}>
              No matching items found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = item.id === selectedItemId;
              const isHighlighted = idx === highlightedIndex;
              const stock = StockEngine.getItemCurrentStock(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
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
                      {item.name}
                      {item.hasSecondaryUnit && (
                        <span style={{ fontSize: '0.78rem', color: '#6B7280', marginLeft: '6px', fontWeight: 600 }}>
                          ({item.unitA?.unitName || 'Unit A'} / {item.unitB?.unitName || 'Unit B'})
                        </span>
                      )}
                    </div>
                    {item.category && (
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                        Category: {item.category}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: stock > 0 ? '#DCFCE7' : '#FEE2E2',
                        color: stock > 0 ? '#15803D' : '#991B1B'
                      }}
                    >
                      Stock: {stock} {item.unitA?.unitName || item.unit || 'Units'}
                    </span>
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
};
