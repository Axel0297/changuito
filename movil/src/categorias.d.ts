export type Categoria =
  | 'botella' | 'lacteo' | 'paquete' | 'aceite' | 'snack' | 'lata'
  | 'limpieza' | 'rollo' | 'frasco' | 'pan' | 'huevo' | 'caja';

export type Rubro = 'almacen' | 'limpieza' | 'perfumeria' | 'bazar';

export const CATEGORIAS: Categoria[];
export const RUBROS: { id: Rubro; nombre: string }[];

export function detectarCategoria(descripcion: string): Categoria;
export function detectarRubro(descripcion: string): Rubro;
