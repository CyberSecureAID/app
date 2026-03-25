'use strict';

const TOKEN_ICONS = {
  _cache: {},

  /*
   * loadIcon(file): Lee un File/Blob y devuelve una Promise<string> con el
   * data-URL base64. Valida tipo MIME y tamaño.
   */
  loadIcon(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));

      const validMimes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!validMimes.includes(file.type)) {
        return reject(new Error('Tipo de archivo no válido. Usa PNG, SVG, JPG o WebP.'));
      }

      const maxBytes = (CONFIG.MAX_ICON_SIZE_KB || 500) * 1024;
      if (file.size > maxBytes) {
        return reject(new Error(`La imagen supera ${CONFIG.MAX_ICON_SIZE_KB || 500} KB. Comprime la imagen y vuelve a intentarlo.`));
      }

      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  },

  /*
   * Devuelve si el tamaño base64 excede MAX_ICON_INLINE_KB (alto gas).
   */
  isLargeIcon(base64Data) {
    const sizeKb = Math.ceil((base64Data.length * 3 / 4) / 1024);
    return sizeKb > (CONFIG.MAX_ICON_INLINE_KB || 50);
  },

  /*
   * setTokenIcon(tokenAddress, iconData): Guarda localmente en cache.
   */
  setTokenIcon(tokenAddress, iconData) {
    if (!tokenAddress) return;
    this._cache[tokenAddress.toLowerCase()] = iconData;
  },

  /*
   * getTokenIcon(tokenAddress): Devuelve img src (data-URL o vacío).
   */
  getTokenIcon(tokenAddress) {
    if (!tokenAddress) return '';
    return this._cache[tokenAddress.toLowerCase()] || '';
  },

  /*
   * renderPreview(base64, containerEl): Muestra preview en un elemento contenedor.
   * Usa DOM methods para evitar XSS con data URLs malformados.
   */
  renderPreview(base64, containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    if (!base64) return;
    // Validate data URL format before inserting
    if (!/^data:image\/(png|svg\+xml|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(base64)) return;
    const img = document.createElement('img');
    img.src = base64;
    img.alt = 'Token icon preview';
    img.className = 'tok-icon-preview';
    containerEl.appendChild(img);
  },
};
