import type { PrecioUnitario } from './unidades';

export interface Cadena {
  id: string;
  nombre: string;
  razon_social: string;
  url: string;
}

export interface Sucursal {
  id: string;
  cadena: string;
  nombre: string;
  tipo: string;
  direccion: string;
  localidad: string;
  lat: number;
  lon: number;
  distancia_km: number;
  horarios: Record<string, string>;
}

/** Sucursal ya resuelta contra la ubicacion del usuario. */
export interface SucursalCercana extends Sucursal {
  indice: number;
  distancia: number;
}

export interface Producto {
  ean: string;
  desc: string;
  cant: number | null;
  unidad: string | null;
  marca: string | null;
  /** en cuantas cadenas distintas aparece este EAN */
  cadenas: number;
}

export interface ProductoEncontrado extends Producto {
  indice: number;
}

export interface Dataset {
  version: number;
  generado: string;
  fecha_datos: string;
  centro: { lat: number; lon: number; nombre: string; radio_km: number };
  cadenas: Cadena[];
  sucursales: Sucursal[];
  productos: Producto[];
  leyendas: Leyenda[];
  /** las dos últimas posiciones sólo vienen cuando hay promoción */
  precios: (
    | [number, number, number, number | null, string | null]
    | [number, number, number, number | null, string | null, number, number]
  )[];
}

export interface Indice {
  dataset: Dataset;
  cadenaPorId: Map<string, Cadena>;
  preciosPorProducto: Map<
    number,
    Map<
      number,
      {
        precio: number;
        precioRef: number | null;
        unidadRef: string | null;
        promo: number | null;
        leyenda: Leyenda | null;
      }
    >
  >;
  conPromo: { si: number; pi: number; precio: number; promo: number; leyenda: Leyenda | null }[];
  busqueda: { i: number; texto: string }[];
  /** EAN -> indice de producto; estable entre regeneraciones del dataset */
  porEan: Map<string, number>;
  porToken: Map<string, number[]>;
  tokensPorProducto: string[][];
}

export interface ItemCarrito {
  indice: number;
  cantidad: number;
}

export interface ItemComparado extends Producto {
  indice: number;
  cantidad: number;
  precio: number;
  subtotal: number;
}

export interface ItemDividido extends ItemComparado {
  sucursal: SucursalCercana;
  cadena: Cadena;
}

export interface ResultadoSucursal {
  sucursal: SucursalCercana;
  cadena: Cadena;
  total: number;
  items: ItemComparado[];
  faltantes: ProductoEncontrado[];
  cobertura: number;
  /** cuantas sucursales de la cadena comparten esta misma lista de precios */
  equivalentes: number;
}

export interface Parada {
  sucursal: SucursalCercana;
  cadena: Cadena;
  items: ItemDividido[];
  total: number;
}

export interface CompraDividida {
  total: number;
  items: ItemDividido[];
  paradas: Parada[];
}

export interface Comparacion {
  porSucursal: ResultadoSucursal[];
  completas: ResultadoSucursal[];
  dividida: CompraDividida;
}

export function normalizar(texto: string): string;
export function crearIndice(dataset: Dataset): Indice;
export function sucursalesCercanas(
  indice: Indice,
  opciones?: { lat?: number | null; lon?: number | null; radioKm?: number }
): SucursalCercana[];
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
export function buscarProductos(
  indice: Indice,
  consulta: string,
  opciones?: { limite?: number; sucursales?: SucursalCercana[] }
): ProductoEncontrado[];
export interface Leyenda {
  texto: string;
  /** aaaa-mm-dd de fin de vigencia, si se pudo leer de la leyenda */
  hasta: string | null;
}

/** Promoción declarada por la cadena: precio de promo contra precio de lista. */
export interface OfertaDeclarada extends Producto {
  indice: number;
  precio: number;
  promo: number;
  descuento: number;
  leyenda: Leyenda | null;
  sucursal: SucursalCercana;
  cadena: Cadena;
  /** cuántas sucursales ofrecen esta misma promo al mismo precio */
  equivalentes: number;
}

export function ofertasDeclaradas(
  indice: Indice,
  sucursales: SucursalCercana[],
  opciones?: {
    limite?: number; minDescuento?: number; rubro?: string | null; busqueda?: string;
  }
): OfertaDeclarada[];

export function cadenasConPromo(
  indice: Indice,
  sucursales: SucursalCercana[]
): { con: Cadena[]; sin: Cadena[] };

export interface Alternativa extends Producto {
  indice: number;
  precio: number;
  enPromo: boolean;
  porUnidad: PrecioUnitario;
  sucursal: SucursalCercana;
  cadena: Cadena;
  coincidencias: number;
  /** cuánto se ahorra por kg/l frente al producto original */
  ahorroPorUnidad: number | null;
}

export function alternativas(
  indice: Indice,
  indiceProducto: number,
  sucursales: SucursalCercana[],
  opciones?: { limite?: number; soloMejores?: boolean; ratioMinimo?: number }
): Alternativa[];

export { normalizarUnidad, precioPorUnidad, formatearPorUnidad } from './unidades';
export type { PrecioUnitario } from './unidades';

export interface PrecioEnSucursal {
  cadena: Cadena;
  sucursal: SucursalCercana;
  precio: number;
  precioRef: number | null;
  unidadRef: string | null;
  /** cuantas sucursales de la bandera comparten este precio */
  equivalentes: number;
}

export function preciosDeProducto(
  indice: Indice,
  indiceProducto: number,
  sucursales: SucursalCercana[]
): PrecioEnSucursal[];
export function compararCarrito(
  indice: Indice,
  carrito: ItemCarrito[],
  sucursales: SucursalCercana[]
): Comparacion;
export function compraDividida(
  indice: Indice,
  carrito: ItemCarrito[],
  sucursales: SucursalCercana[]
): CompraDividida;
export function formatearPesos(n: number): string;
