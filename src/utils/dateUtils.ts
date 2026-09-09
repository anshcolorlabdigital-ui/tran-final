/**
 * Date utility functions for DD-MM-YYYY format
 */

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // ISO format for internal storage & inputs (YYYY-MM-DD)
}

export function formatDateToDisplay(isoDateStr?: string): string {
  if (!isoDateStr) return '';
  // Handles YYYY-MM-DD or DD-MM-YYYY or ISO
  if (isoDateStr.includes('-')) {
    const parts = isoDateStr.split('T')[0].split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD-MM-YYYY
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    } else if (parts[2].length === 4) {
      // already DD-MM-YYYY
      return isoDateStr;
    }
  }
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return isoDateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function parseDisplayDateToISO(displayStr: string): string {
  if (!displayStr) return getTodayDateString();
  const parts = displayStr.trim().split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return displayStr;
}

export const formatDateDMY = formatDateToDisplay;

