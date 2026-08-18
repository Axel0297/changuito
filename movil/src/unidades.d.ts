export interface UnidadBase {
  base: 'kg' | 'l' | 'un';
  factor: number;
}

export interface PrecioUnitario {
  valor: number;
  unidad: 'kg' | 'l' | 'un';
  cantidad: number;
}

export function normalizarUnidad(unidad: string | null): UnidadBase | null;
export function precioPorUnidad(
  producto: { cant: number | null; unidad: string | null } | null,
  precio: number
): PrecioUnitario | null;
export function formatearPorUnidad(pu: PrecioUnitario | null): string;
export function tokensDeProducto(
  producto: { desc: string; marca: string | null } | null
): string[];
