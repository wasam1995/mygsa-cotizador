'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { classNames } from '@/lib/utils';

/**
 * Botón de solo ícono reutilizable — reemplaza los botones que antes usaban `title="..."`
 * (no es un tooltip real: es lento, no es accesible por teclado y no se ve en móvil) o que
 * no tenían ninguna etiqueta visible. Siempre trae:
 *  - un tooltip real (se ve al pasar el mouse Y al enfocar con teclado, no solo con `title`)
 *  - `aria-label` para lectores de pantalla
 *  - tamaño `default` = 44×44px (mínimo recomendado para que sea fácil de tocar en celular)
 *
 * `size="compact"` (36×36px) es para filas de tabla muy densas (cotizaciones, parámetros)
 * donde crecer cada ícono a 44px haría la fila demasiado alta — sigue siendo bastante más
 * grande que el botón de 16-20px que había antes, con tooltip y aria-label igual.
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'danger' | 'success';
  size?: 'default' | 'compact';
  /** Clases para el <span> contenedor (p.ej. "ml-auto" para empujarlo dentro de un flex). */
  wrapperClassName?: string;
  /** "above" (por defecto) o "below" — usar "below" para íconos pegados arriba de la
   * pantalla (el header), donde un tooltip hacia arriba quedaría cortado. */
  tooltipPosition?: 'above' | 'below';
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'default', className, wrapperClassName, tooltipPosition = 'above', type = 'button', ...props },
  ref
) {
  return (
    <span className={classNames('group/icon-btn relative inline-flex', wrapperClassName)}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={classNames(
          'icon-btn',
          size === 'compact' && 'icon-btn-compact',
          variant === 'danger' && 'icon-btn-danger',
          variant === 'success' && 'icon-btn-success',
          className
        )}
        {...props}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className={classNames('icon-btn-tooltip', tooltipPosition === 'below' && 'icon-btn-tooltip-below')}
      >
        {label}
      </span>
    </span>
  );
});

export default IconButton;
