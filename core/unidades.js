/**
 * Precio por unidad de medida: $/kg, $/l, $/unidad.
 *
 * SEPA publica un campo `precio_referencia` que deberia servir para esto, pero
 * en el 47% de las filas es una copia literal del precio de lista ("HUEVOS X
 * 12UN $3.149 -> $3.149/EA"), asi que no se puede usar. En cambio, el 100% de
 * los productos trae su cantidad y su unidad de presentacion, y con eso el
 * calculo sale bien.
 *
 * Modulo puro, compartido entre el motor y la app.
 */

/** Las cadenas escriben la misma unidad de ocho formas distintas. */
const EQUIVALENCIAS = [
  // [regex sobre la unidad normalizada, unidad base, factor hacia la base]
  [/^(kg|kgs|kgm|kgr|kilo|kilos)$/, 'kg', 1],
  [/^(gr|grs|gra|gram|gramo|gramos|grm|g)$/, 'kg', 0.001],
  [/^(mg)$/, 'kg', 0.000001],
  [/^(l|lt|lts|ltr|litro|litros)$/, 'l', 1],
  [/^(ml|cm3|cc|mililitro|mililitros)$/, 'l', 0.001],
  [/^(ea|un|uni|unid|unidad|unidades|u|cu|pck|paq|pack)$/, 'un', 1],
];

/**
 * Lleva la unidad declarada a kg, l o un.
 * Devuelve null para lo que no se puede comparar (metros, m2, etc.).
 */
export function normalizarUnidad(unidad) {
  const u = String(unidad || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!u) return null;
  for (const [re, base, factor] of EQUIVALENCIAS) {
    if (re.test(u)) return { base, factor };
  }
  return null;
}

/**
 * Precio por unidad de un producto a un precio dado.
 * Devuelve null cuando no se puede calcular o el resultado es absurdo.
 */
export function precioPorUnidad(producto, precio) {
  if (!(precio > 0)) return null;
  const u = normalizarUnidad(producto?.unidad);
  if (!u) return null;

  const cantidad = Number(producto.cant) * u.factor;
  if (!(cantidad > 0)) return null;

  const valor = precio / cantidad;
  // Un $/kg de mil millones sale de una cantidad mal cargada, no de un precio.
  if (!Number.isFinite(valor) || valor > 1e7) return null;

  return { valor, unidad: u.base, cantidad };
}

/** "$1.234/kg" */
export function formatearPorUnidad(pu) {
  if (!pu) return '';
  const n = pu.valor >= 100 ? Math.round(pu.valor) : Math.round(pu.valor * 100) / 100;
  return '$' + n.toLocaleString('es-AR') + '/' + pu.unidad;
}

const PALABRAS_IGNORADAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'para', 'por', 'en', 'y',
  'x', 'un', 'una', 'al', 'su', 'tipo', 'sabor', 'gr', 'grs', 'kg', 'ml', 'lt',
  'cc', 'un', 'uni', 'pack', 'paq', 'unid', 'cm3', 'mtr', 'ea',
]);

/**
 * Palabras que identifican de que producto se trata, sacando marca, tamaños y
 * relleno. "TARAGUI YERBA MATE 1KG" -> ["yerba", "mate"].
 *
 * Se saca la marca a proposito: la gracia de buscar equivalentes es justamente
 * encontrar la otra marca del mismo producto.
 */
export function tokensDeProducto(producto) {
  const marca = String(producto?.marca || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const marcaTokens = new Set(marca.split(/[^a-z0-9]+/).filter(Boolean));

  return String(producto?.desc || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !/^\d/.test(t) &&
        !PALABRAS_IGNORADAS.has(t) &&
        !marcaTokens.has(t)
    );
}
