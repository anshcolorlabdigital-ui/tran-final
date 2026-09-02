import { toPng } from 'html-to-image';
import { formatDateToDisplay } from './dateUtils';

export interface ReceiptItem {
  sno: string;
  itemName: string;
  qty: number;
}

export interface ReceiptData {
  date: string;
  items: ReceiptItem[];
}

/**
 * Formats receipt text suitable for WhatsApp / Clipboard messaging
 */
export function formatReceiptText(data: ReceiptData): string {
  const displayDate = formatDateToDisplay(data.date);
  let text = `*ORDER*\n\nDate: ${displayDate}\n\n`;
  text += `S.No.   Item                    Qty\n`;
  text += `-------------------------------------\n`;

  data.items.forEach((item, index) => {
    const snoDisplay = (item.sno || `${1456 + index}`).padEnd(7, ' ');
    const nameDisplay = item.itemName.padEnd(24, ' ');
    text += `${snoDisplay} ${nameDisplay} ${item.qty}\n`;
  });

  return text;
}

/**
 * Downloads a DOM element as PNG
 */
export async function downloadReceiptImage(element: HTMLElement, filename = 'order-receipt.png') {
  try {
    const dataUrl = await toPng(element, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (err) {
    console.error('Failed to generate PNG image:', err);
    return false;
  }
}

/**
 * Shares receipt to WhatsApp
 */
export function shareToWhatsApp(data: ReceiptData, phone = '') {
  const text = formatReceiptText(data);
  const encoded = encodeURIComponent(text);
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
  window.open(url, '_blank');
}

/**
 * Native Web Share API with image file if supported
 */
export async function shareReceiptNative(element: HTMLElement, data: ReceiptData) {
  const text = formatReceiptText(data);
  if (navigator.share) {
    try {
      if (element) {
        const dataUrl = await toPng(element, { quality: 0.95, pixelRatio: 2 });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `order-${data.date}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Order Receipt',
            text: text,
            files: [file]
          });
          return true;
        }
      }
      await navigator.share({
        title: 'Order Receipt',
        text: text
      });
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    }
  }
  return false;
}
