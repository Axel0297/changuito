/**
 * Ilustraciones de producto, a trazo, estilo grabado de almacen viejo.
 *
 * SEPA no publica fotos y Open Food Facts sólo cubre alimentos (y ni siquiera
 * todos), asi que la mayoria de los productos nunca va a tener imagen real. En
 * vez de dejar un cuadrado gris, cada producto recibe un dibujo segun lo que es.
 */
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { COLORES_ETIQUETA } from './tema';
import type { Categoria } from './categorias';

export { detectarCategoria } from './categorias';
export type { Categoria } from './categorias';

/** Color estable por producto: el mismo EAN siempre sale del mismo color. */
export function colorDeEtiqueta(ean: string): string {
  let h = 0;
  for (let i = 0; i < ean.length; i++) h = (h * 31 + ean.charCodeAt(i)) >>> 0;
  return COLORES_ETIQUETA[h % COLORES_ETIQUETA.length];
}

interface Props {
  categoria: Categoria;
  color: string;
  tamano?: number;
}

export function IconoProducto({ categoria, color, tamano = 44 }: Props) {
  const t = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 40 40">
      {categoria === 'botella' && (
        <>
          <Path d="M17 5h6v5l3 5v20a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V15l3-5V5z" {...t} />
          <Line x1="14" y1="20" x2="26" y2="20" {...t} />
          <Line x1="14" y1="28" x2="26" y2="28" {...t} />
        </>
      )}

      {categoria === 'lacteo' && (
        <>
          <Path d="M13 14h14v22a1 1 0 0 1-1 1H14a1 1 0 0 1-1-1V14z" {...t} />
          <Path d="M13 14l3-8h8l3 8" {...t} />
          <Line x1="16" y1="6" x2="24" y2="6" {...t} />
          <Line x1="13" y1="24" x2="27" y2="24" {...t} />
        </>
      )}

      {categoria === 'paquete' && (
        <>
          <Path d="M11 12h18v24a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1V12z" {...t} />
          <Path d="M11 12l2-5h14l2 5" {...t} />
          <Line x1="15" y1="21" x2="25" y2="21" {...t} />
          <Line x1="15" y1="27" x2="25" y2="27" {...t} />
        </>
      )}

      {categoria === 'aceite' && (
        <>
          <Path d="M18 4h4v4l4 6v21a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14l4-6V4z" {...t} />
          <Rect x="16" y="19" width="8" height="8" rx="1" {...t} />
        </>
      )}

      {categoria === 'snack' && (
        <>
          <Path d="M9 12l4 3h14l4-3v16l-4 3H13l-4-3V12z" {...t} />
          <Line x1="13" y1="15" x2="13" y2="31" {...t} />
          <Line x1="27" y1="15" x2="27" y2="31" {...t} />
        </>
      )}

      {categoria === 'lata' && (
        <>
          <Path d="M12 11c0-2 3.6-3 8-3s8 1 8 3v18c0 2-3.6 3-8 3s-8-1-8-3V11z" {...t} />
          <Path d="M12 11c0 2 3.6 3 8 3s8-1 8-3" {...t} />
          <Line x1="13" y1="20" x2="27" y2="20" {...t} />
        </>
      )}

      {categoria === 'limpieza' && (
        <>
          <Path d="M16 13h9v23a1 1 0 0 1-1 1H17a1 1 0 0 1-1-1V13z" {...t} />
          <Path d="M18 13V9h5v4" {...t} />
          <Path d="M23 9h4l2-3" {...t} />
          <Line x1="16" y1="22" x2="25" y2="22" {...t} />
        </>
      )}

      {categoria === 'rollo' && (
        <>
          <Path d="M9 12c0-2.2 2.5-4 5.5-4S20 9.8 20 12v20c0 2.2-2.5 4-5.5 4S9 34.2 9 32V12z" {...t} />
          <Path d="M9 12c0 2.2 2.5 4 5.5 4S20 14.2 20 12" {...t} />
          <Circle cx="14.5" cy="12" r="2" {...t} />
          <Path d="M20 16h9c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-9" {...t} />
        </>
      )}

      {categoria === 'frasco' && (
        <>
          <Path d="M14 15h12v20a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V15z" {...t} />
          <Rect x="16" y="7" width="8" height="8" rx="1" {...t} />
          <Line x1="14" y1="25" x2="26" y2="25" {...t} />
        </>
      )}

      {categoria === 'pan' && (
        <>
          <Path d="M7 22c0-6 5.8-10 13-10s13 4 13 10c0 5-5.8 8-13 8S7 27 7 22z" {...t} />
          <Path d="M14 14c1.5 3 1.5 6 0 9" {...t} />
          <Path d="M20 13c1.5 3 1.5 7 0 10" {...t} />
          <Path d="M26 14c1.5 3 1.5 6 0 9" {...t} />
        </>
      )}

      {categoria === 'huevo' && (
        <>
          <Path d="M20 6c5 0 9 8 9 14s-4 10-9 10-9-4-9-10S15 6 20 6z" {...t} />
          <Path d="M15 22c1 2 3 3 5 3" {...t} />
        </>
      )}

      {categoria === 'caja' && (
        <>
          <Path d="M8 14l12-6 12 6v16l-12 6-12-6V14z" {...t} />
          <Path d="M8 14l12 6 12-6" {...t} />
          <Line x1="20" y1="20" x2="20" y2="36" {...t} />
        </>
      )}
    </Svg>
  );
}
