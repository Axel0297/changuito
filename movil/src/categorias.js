/**
 * Clasificacion de productos a partir de la descripcion.
 *
 * SEPA no publica categoria ni rubro: sólo un texto libre por producto. Estas
 * reglas son heuristicas y se equivocan a veces, pero alcanzan para lo que se
 * usan: elegir un dibujo y separar la comida del bazar en las ofertas.
 *
 * Modulo puro compartido entre el ETL, las pruebas y la app.
 */

/** Dibujo que le toca al producto. */
export const CATEGORIAS = [
  'botella', 'lacteo', 'paquete', 'aceite', 'snack', 'lata',
  'limpieza', 'rollo', 'frasco', 'pan', 'huevo', 'caja',
];

/**
 * Cosas que no son comida por mas que su nombre diga lo contrario.
 *
 * Se evalua antes que todo lo demas. Sin esto, "SET DE VERDURAS DE 8 PIEZAS"
 * (un juguete) y "PLATO POSTRE" entran como almacen, y encabezan las ofertas.
 */
const RE_NO_COMESTIBLE =
  /resaltador|lapiz|birome|cuaderno|libreria|plato|vaso |taza |cubierto|cuchara|tenedor|cuchillo|olla |sarten|cacerola|pava |bikini|bombacha|remera|pantalon|campera|calzoncillo|toalla(?!ita)|soporte|set de |kit |peluche|juguete|vehiculo|muñec|pelota|bicicleta|caloventor|estufa|ventilador|calefactor|notebook|televisor|smart ?tv|monitor|auricular|parlante|dispenser|jabonera|portacepillo|almohada|sabana|acolchado|colchon|silla |mesa |mueble|maceta|manguera|foco |lampara|cable |pila |bateria|escarbadiente|canopla|mochila|valija|bolso|film |instax|camara|herramienta|taladro|pintura|perchero|cesto|balde|escoba|secador|plancha|licuadora|batidora|cafetera|microondas|heladera|lavarropas|aspiradora|depiladora|horno|panificadora|tostadora|freidora|procesadora/i;

const REGLAS_CATEGORIA = [
  [/papel higien|servilleta|rollo coc|toallita|papel de cocina/i, 'rollo'],
  [/lavandina|detergente|jabon liq|limpiador|desengras|suavizante|lavavajilla|limpia/i, 'limpieza'],
  [/shampoo|acondicionador|desodorante|antitranspir|crema (facial|de manos|corporal)|colonia|perfume|jabon|pasta dental|cepillo/i, 'frasco'],
  [/aceite|vinagre|oliva/i, 'aceite'],
  [/leche|yogur|queso|manteca|crema de leche|dulce de leche|postre|flan/i, 'lacteo'],
  [/gaseosa|agua|jugo|vino|cerveza|soda|bebida|gatorade|energizante|amargo|aperitivo|spritz/i, 'botella'],
  [/atun|caballa|arveja|choclo|tomate perita|conserva|pate|lata/i, 'lata'],
  [/galletit|oblea|alfajor|chocolate|caramelo|chicle|turron|bombon|snack|papas fritas|palito/i, 'snack'],
  [/pan |pan$|baguette|factura|budin|bizcochuelo|tostada|medialuna/i, 'pan'],
  [/huevo/i, 'huevo'],
  // Con \b, porque "te" y "sal" sueltos matchean dentro de otras palabras:
  // /te / capturaba "sopor{te }TV" y lo mandaba a la gondola de almacen.
  [/fideo|arroz|harina|azucar|yerba|\bte\b|cafe|polenta|lenteja|poroto|\bsal\b|pure|avena|cereal/i, 'paquete'],
  // Red mas amplia de comida, al final para no pisar a las anteriores. No tiene
  // dibujo propio: le toca el de paquete.
  [
    /carne|pollo|milanesa|hamburguesa|salchich|chorizo|jamon|mortadela|salame|panceta|fiamb|pescado|merluza|verdura|\bfruta|\bpapas?\b|cebolla|tomate|banana|manzana|zanahoria|helado|congelad|pizza|empanada|sopa|caldo|mayonesa|ketchup|mostaza|salsa|mermelada|miel|edulcorante|gelatina|levadura|condimento|especia|rebozador|pan rallado|semilla|\bnuez\b|almendra|pasas|garbanzo|arveja|choclo|palmito|aceituna|pickle|ravioles|ñoqui|premezcla/i,
    'paquete',
  ],
];

export function detectarCategoria(descripcion) {
  if (RE_NO_COMESTIBLE.test(descripcion || '')) return 'caja';
  for (const [re, cat] of REGLAS_CATEGORIA) if (re.test(descripcion)) return cat;
  return 'caja';
}

/**
 * Rubro, para poder separar la compra del super de lo que no lo es.
 *
 * Importa sobre todo en las ofertas: sin esto, los mejores descuentos son
 * siempre peluches, notebooks y resaltadores, que no es lo que alguien busca
 * en un comparador de supermercado.
 */
export const RUBROS = [
  { id: 'almacen', nombre: 'Almacén' },
  { id: 'limpieza', nombre: 'Limpieza' },
  { id: 'perfumeria', nombre: 'Perfumería' },
  { id: 'bazar', nombre: 'Bazar y otros' },
];

/**
 * El rubro se deduce de la categoria, no de una lista negra de bazar.
 *
 * Se intento al reves —marcar lo que fuera electro, juguete o libreria— y no
 * alcanza nunca: siempre entra un "KIT BASICO TECHO" o un "SET DE VERDURAS"
 * (que es un juguete) a la lista de ofertas de almacen. Con lista blanca, lo
 * que no se reconoce como comida cae en "bazar y otros", que es el error que
 * conviene cometer: es peor mostrar un caloventor entre los fideos que dejar
 * una mortadela afuera.
 */
const RUBRO_POR_CATEGORIA = {
  botella: 'almacen',
  lacteo: 'almacen',
  paquete: 'almacen',
  aceite: 'almacen',
  snack: 'almacen',
  lata: 'almacen',
  pan: 'almacen',
  huevo: 'almacen',
  limpieza: 'limpieza',
  rollo: 'limpieza',
  frasco: 'perfumeria',
  caja: 'bazar',
};

export function detectarRubro(descripcion) {
  return RUBRO_POR_CATEGORIA[detectarCategoria(descripcion)] ?? 'bazar';
}
