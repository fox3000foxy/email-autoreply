import { franc } from 'franc';

export function detectLanguage(textContent: string, htmlContent: string): string {
  const detected = franc(`${textContent} ${htmlContent}`, { minLength: 20 });
  if (detected === 'fra') return 'fr';
  if (detected === 'eng') return 'en';
  return 'fr';
}
