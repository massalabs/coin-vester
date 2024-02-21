export function _setInStorage(key: string, value: string): void {
  if (typeof Storage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

export function _getFromStorage(key: string): string {
  return localStorage.getItem(key) || '';
}
