/**
 * Motor de comparacion. Modulo puro, sin dependencias: corre igual en Node
 * (para tests con el dataset real) que dentro de React Native.
 *
 * El dataset viene del ETL con precios como tuplas compactas
 * [indice_sucursal, indice_producto, precio, precio_ref, unidad_ref] y, cuando
 * la cadena declara promocion, dos campos mas: (precio_promo, indice_leyenda).
 */
import { detectarRubro } from './categorias.js';
import { normalizarUnidad, precioPorUnidad, tokensDeProducto } from './unidades.js';

export { precioPorUnidad, formatearPorUnidad, normalizarUnidad } from './unidades.js';

/** Normaliza texto para buscar: minusculas y sin acentos. */
export function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Indexa el dataset una sola vez al arrancar. Todo lo demas trabaja sobre esto.
 */
export function crearIndice(dataset) {
  const cadenaPorId = new Map(dataset.cadenas.map((c) => [c.id, c]));

  // producto -> Map(indiceSucursal -> {precio, precioRef, unidadRef, promo, leyenda})
  const preciosPorProducto = new Map();
  // Las promos son pocas (miles contra cientos de miles de precios): se listan
  // aparte para no recorrer todo el dataset cada vez que se abren las ofertas.
  const conPromo = [];

  for (const fila of dataset.precios) {
    // v2 agrupa por precio: una entrada vale para todas las sucursales que lo
    // comparten. v1 traia una fila por sucursal.
    const esV2 = Array.isArray(fila[6]);
    const [pi, precio, precioRef, unidadRef, promo, leyendaIdx, sucursalesDelPrecio] = esV2
      ? fila
      : [fila[1], fila[2], fila[3], fila[4], fila[5] ?? null, fila[6] ?? null, [fila[0]]];

    const leyenda = leyendaIdx != null ? dataset.leyendas?.[leyendaIdx] ?? null : null;

    // Un solo objeto para todas las sucursales que comparten este precio: es la
    // mitad de los objetos en memoria, que es lo que ahoga a un telefono modesto.
    const dato = { precio, precioRef, unidadRef, promo: promo ?? null, leyenda };

    let m = preciosPorProducto.get(pi);
    if (!m) preciosPorProducto.set(pi, (m = new Map()));
    for (const si of sucursalesDelPrecio) {
      m.set(si, dato);
      if (dato.promo != null) conPromo.push({ si, pi, precio, promo: dato.promo, leyenda });
    }
  }

  const busqueda = dataset.productos.map((p, i) => ({
    i,
    texto: normalizar(p.desc + ' ' + (p.marca || '')),
  }));

  // El indice de un producto cambia cada vez que se regenera el dataset; el EAN
  // no. Todo lo que se persista entre corridas tiene que apoyarse en el EAN.
  const porEan = new Map(dataset.productos.map((p, i) => [p.ean, i]));

  // Indice invertido palabra -> productos, para encontrar equivalentes de otra
  // marca o de otro tamaño sin recorrer los 44 mil productos cada vez.
  const porToken = new Map();
  const tokensPorProducto = dataset.productos.map((p, i) => {
    const tokens = tokensDeProducto(p);
    for (const t of tokens) {
      let lista = porToken.get(t);
      if (!lista) porToken.set(t, (lista = []));
      lista.push(i);
    }
    return tokens;
  });

  return {
    dataset, cadenaPorId, preciosPorProducto, busqueda, porEan, conPromo,
    porToken, tokensPorProducto,
  };
}

/** Sucursales dentro de un radio, ordenadas por cercania al usuario. */
export function sucursalesCercanas(indice, { lat, lon, radioKm = 5 } = {}) {
  const { dataset } = indice;
  const conDistancia = dataset.sucursales.map((s, i) => {
    // Si no hay GPS, cae a la distancia precalculada desde el centro de Trelew.
    const dist =
      lat != null && lon != null
        ? distanciaKm(lat, lon, s.lat, s.lon)
        : s.distancia_km;
    return { ...s, indice: i, distancia: Number(dist.toFixed(1)) };
  });
  return conDistancia
    .filter((s) => s.distancia <= radioKm)
    .sort((a, b) => a.distancia - b.distancia);
}

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Busca productos por texto. Prioriza lo que esta en mas cadenas, porque es lo
 * que sirve para comparar: un producto que existe en un solo super no compara nada.
 */
export function buscarProductos(indice, consulta, { limite = 40, sucursales } = {}) {
  const q = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (q.length === 0) return [];

  const visibles = sucursales ? new Set(sucursales.map((s) => s.indice)) : null;
  const resultados = [];

  for (const { i, texto } of indice.busqueda) {
    if (!q.every((t) => texto.includes(t))) continue;
    if (visibles) {
      const precios = indice.preciosPorProducto.get(i);
      if (!precios || ![...precios.keys()].some((si) => visibles.has(si))) continue;
    }
    const p = indice.dataset.productos[i];
    resultados.push({ ...p, indice: i });
  }

  resultados.sort((a, b) => b.cadenas - a.cadenas || a.desc.length - b.desc.length);
  return resultados.slice(0, limite);
}

/** El precio mas bajo de un producto entre las sucursales visibles. */
function mejorPrecioEn(indice, pi, porIndiceSucursal) {
  const precios = indice.preciosPorProducto.get(pi);
  if (!precios) return null;
  let mejor = null;
  for (const [si, dato] of precios) {
    const suc = porIndiceSucursal.get(si);
    if (!suc) continue;
    const efectivo = dato.promo ?? dato.precio;
    if (!mejor || efectivo < mejor.precio ||
        (efectivo === mejor.precio && suc.distancia < mejor.sucursal.distancia)) {
      mejor = { precio: efectivo, sucursal: suc, enPromo: dato.promo != null };
    }
  }
  return mejor;
}

/**
 * Equivalentes de un producto que rinden mejor por kilo o por litro.
 *
 * Sirve para las dos cosas que la comparacion por EAN exacto no puede hacer:
 * avisar que el paquete grande conviene mas, y ofrecer otra marca del mismo
 * producto cuando la que el usuario eligio no esta en ese super.
 *
 * @param opciones.sucursales limita a las sucursales visibles
 * @param opciones.soloMejores devuelve unicamente los que mejoran el $/unidad
 */
export function alternativas(
  indice,
  pi,
  sucursales,
  { limite = 5, soloMejores = true, ratioMinimo = 0.2 } = {}
) {
  const producto = indice.dataset.productos[pi];
  const unidad = normalizarUnidad(producto?.unidad);
  if (!unidad) return [];

  const porIndiceSucursal = new Map(sucursales.map((s) => [s.indice, s]));
  const propio = mejorPrecioEn(indice, pi, porIndiceSucursal);
  const puPropio = propio ? precioPorUnidad(producto, propio.precio) : null;

  const tokens = indice.tokensPorProducto[pi];
  if (!tokens?.length) return [];

  // Cuantos tokens comparte cada candidato. Con dos alcanza para "yerba mate";
  // si el nombre es muy corto, se acepta uno.
  const minimo = tokens.length >= 3 ? 2 : 1;
  const puntaje = new Map();
  for (const t of tokens) {
    for (const otro of indice.porToken.get(t) ?? []) {
      if (otro === pi) continue;
      puntaje.set(otro, (puntaje.get(otro) ?? 0) + 1);
    }
  }

  const resultado = [];
  for (const [otro, n] of puntaje) {
    if (n < minimo) continue;

    const candidato = indice.dataset.productos[otro];
    const u = normalizarUnidad(candidato.unidad);
    // Sólo se comparan cosas medidas en lo mismo: no tiene sentido enfrentar
    // $/kg contra $/litro.
    if (!u || u.base !== unidad.base) continue;

    const mejor = mejorPrecioEn(indice, otro, porIndiceSucursal);
    if (!mejor) continue;

    const pu = precioPorUnidad(candidato, mejor.precio);
    if (!pu) continue;
    if (soloMejores && puPropio && pu.valor >= puPropio.valor) continue;

    // Rendir cinco veces mas por kilo no es una ganga, es un dato mal cargado:
    // "ACUENTA FIDEOS $61" sale $123/kg contra $3.058/kg del resto. Sin este
    // piso, los equivalentes serian siempre los errores de carga del dataset.
    if (puPropio && pu.valor < puPropio.valor * ratioMinimo) continue;

    resultado.push({
      ...candidato,
      indice: otro,
      precio: mejor.precio,
      enPromo: mejor.enPromo,
      porUnidad: pu,
      sucursal: mejor.sucursal,
      cadena: indice.cadenaPorId.get(mejor.sucursal.cadena),
      coincidencias: n,
      // Cuanto se ahorra por kilo/litro frente al que el usuario eligio.
      ahorroPorUnidad: puPropio ? puPropio.valor - pu.valor : null,
    });
  }

  return resultado
    .sort((a, b) => a.porUnidad.valor - b.porUnidad.valor)
    .slice(0, limite);
}

/** Hoy en formato aaaa-mm-dd, para comparar contra la vigencia de las promos. */
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Ofertas declaradas por las cadenas: precio de promocion contra precio de lista.
 *
 * Ojo con la cobertura: no todas las cadenas informan promociones. En Trelew las
 * publican Carrefour y La Anonima; Changomas y Vea no informan ninguna, y eso no
 * significa que no tengan ofertas en la gondola. La UI tiene que decirlo.
 */
export function ofertasDeclaradas(
  indice,
  sucursales,
  { limite = 60, minDescuento = 0.05, rubro = null, busqueda = '' } = {}
) {
  const porIndice = new Map(sucursales.map((s) => [s.indice, s]));
  const hoy = hoyISO();
  const mejorPorClave = new Map();

  // Buscar por texto tiene que filtrar acá y no en la pantalla: si se recortara
  // despues del limite, "yerba" solo encontraria lo que entro en los primeros
  // resultados. Cuando hay busqueda se ignora el rubro, porque quien escribe
  // "lavandina" espera encontrarla sin fijarse en que solapa esta parado.
  const termino = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const buscando = termino.length > 0;

  for (const { si, pi, precio, promo, leyenda } of indice.conPromo) {
    const suc = porIndice.get(si);
    if (!suc) continue;

    const producto = indice.dataset.productos[pi];
    if (buscando) {
      const texto = normalizar(producto.desc + ' ' + (producto.marca || ''));
      if (!termino.every((t) => texto.includes(t))) continue;
    } else if (rubro && detectarRubro(producto.desc) !== rubro) {
      continue;
    }
    // Una promo que ya vencio no es una oferta. Si no se pudo leer la fecha, se
    // muestra igual: el dato del dia es de hoy.
    if (leyenda?.hasta && leyenda.hasta < hoy) continue;

    const descuento = 1 - promo / precio;
    if (descuento < minDescuento) continue;

    // La misma promo se repite en cada sucursal, y a veces en varias cadenas al
    // mismo precio. Se muestra una sola vez, la mas cercana, contando el resto.
    const clave = `${pi}|${Math.round(promo)}`;
    const previo = mejorPorClave.get(clave);
    if (previo) {
      previo.equivalentes++;
      if (suc.distancia < previo.sucursal.distancia) {
        previo.sucursal = suc;
        previo.cadena = indice.cadenaPorId.get(suc.cadena);
      }
      continue;
    }

    mejorPorClave.set(clave, {
      ...indice.dataset.productos[pi],
      indice: pi,
      precio,
      promo,
      descuento,
      leyenda,
      sucursal: suc,
      cadena: indice.cadenaPorId.get(suc.cadena),
      equivalentes: 1,
    });
  }

  return [...mejorPorClave.values()]
    .sort((a, b) => b.descuento - a.descuento || a.sucursal.distancia - b.sucursal.distancia)
    .slice(0, limite);
}

/** Cadenas de la zona que informan promociones, y cuales no. */
export function cadenasConPromo(indice, sucursales) {
  const porIndice = new Map(sucursales.map((s) => [s.indice, s]));
  const con = new Set();
  for (const { si } of indice.conPromo) {
    const suc = porIndice.get(si);
    if (suc) con.add(suc.cadena);
  }
  const todas = new Set(sucursales.map((s) => s.cadena));
  const sin = [...todas].filter((c) => !con.has(c));
  return {
    con: [...con].map((c) => indice.cadenaPorId.get(c)),
    sin: sin.map((c) => indice.cadenaPorId.get(c)),
  };
}

/**
 * Precio de un solo producto en cada sucursal cercana, de mas barato a mas caro.
 * Es lo que se muestra al escanear un codigo de barras en la gondola.
 *
 * Agrupa por bandera: las cadenas informan la misma lista en todas sus sucursales,
 * asi que sin agrupar la pantalla repite el mismo precio ocho veces.
 */
export function preciosDeProducto(indice, indiceProducto, sucursales) {
  const precios = indice.preciosPorProducto.get(indiceProducto);
  if (!precios) return [];

  const porBandera = new Map();
  for (const suc of sucursales) {
    const dato = precios.get(suc.indice);
    if (!dato) continue;
    const clave = `${suc.cadena}|${Math.round(dato.precio)}`;
    const previo = porBandera.get(clave);
    if (!previo) {
      porBandera.set(clave, {
        cadena: indice.cadenaPorId.get(suc.cadena),
        sucursal: suc,
        precio: dato.precio,
        precioRef: dato.precioRef,
        unidadRef: dato.unidadRef,
        equivalentes: 1,
      });
    } else {
      previo.equivalentes++;
      if (suc.distancia < previo.sucursal.distancia) previo.sucursal = suc;
    }
  }

  return [...porBandera.values()].sort(
    (a, b) => a.precio - b.precio || a.sucursal.distancia - b.sucursal.distancia
  );
}

/**
 * Compara un carrito entre sucursales.
 *
 * Devuelve, por sucursal, el total de lo que SI tiene y que items le faltan.
 * No completa faltantes con estimaciones: un total de 11/14 items no es
 * comparable con uno de 14/14 y la UI tiene que mostrarlo asi.
 *
 * @param carrito [{ indice, cantidad }]
 */
export function compararCarrito(indice, carrito, sucursales) {
  const { dataset } = indice;

  const porSucursal = sucursales.map((suc) => {
    const items = [];
    const faltantes = [];
    let total = 0;

    for (const item of carrito) {
      const precios = indice.preciosPorProducto.get(item.indice);
      const dato = precios?.get(suc.indice);
      const producto = dataset.productos[item.indice];
      if (!dato) {
        faltantes.push({ ...producto, indice: item.indice });
        continue;
      }
      const cantidad = item.cantidad ?? 1;
      const subtotal = dato.precio * cantidad;
      total += subtotal;
      items.push({ ...producto, indice: item.indice, cantidad, precio: dato.precio, subtotal });
    }

    return {
      sucursal: suc,
      cadena: indice.cadenaPorId.get(suc.cadena),
      total,
      items,
      faltantes,
      cobertura: carrito.length ? items.length / carrito.length : 0,
    };
  });

  // Una sucursal que no tiene nada del carrito no es una opcion, es ruido.
  const utiles = porSucursal.filter((r) => r.items.length > 0);

  // Primero los que tienen mas del carrito; a igual cobertura, el mas barato.
  utiles.sort((a, b) => b.items.length - a.items.length || a.total - b.total);

  const agrupadas = agruparEquivalentes(utiles);

  return {
    porSucursal: agrupadas,
    completas: agrupadas.filter((r) => r.faltantes.length === 0),
    dividida: compraDividida(indice, carrito, sucursales),
  };
}

/**
 * Las cadenas informan la misma lista de precios en todas sus sucursales, asi
 * que sin agrupar la pantalla repite ocho veces "La Anonima $23.350". Se deja
 * la sucursal mas cercana de cada grupo y se cuenta el resto.
 */
function agruparEquivalentes(resultados) {
  const grupos = new Map();
  for (const r of resultados) {
    const clave = `${r.cadena.id}|${Math.round(r.total)}|${r.items.length}`;
    const previo = grupos.get(clave);
    if (!previo) {
      grupos.set(clave, { ...r, equivalentes: 1 });
    } else {
      previo.equivalentes++;
      if (r.sucursal.distancia < previo.sucursal.distancia) previo.sucursal = r.sucursal;
    }
  }
  return [...grupos.values()];
}

/**
 * Compra dividida: cada item donde este mas barato. Es el techo del ahorro
 * posible, y sirve para responder "cuanto pierdo por comprar todo en un solo lugar".
 */
export function compraDividida(indice, carrito, sucursales) {
  const porSuc = new Map(sucursales.map((s) => [s.indice, s]));
  const items = [];
  let total = 0;

  for (const item of carrito) {
    const precios = indice.preciosPorProducto.get(item.indice);
    if (!precios) continue;

    let mejor = null;
    for (const [si, dato] of precios) {
      const suc = porSuc.get(si);
      if (!suc) continue;
      // A igual precio conviene la sucursal mas cercana: sin este desempate la
      // app te manda a otra ciudad a buscar algo que cuesta lo mismo al lado.
      const mejora =
        !mejor ||
        dato.precio < mejor.precio ||
        (dato.precio === mejor.precio && suc.distancia < mejor.distancia);
      if (mejora) mejor = { si, precio: dato.precio, distancia: suc.distancia };
    }
    if (!mejor) continue;

    const cantidad = item.cantidad ?? 1;
    const subtotal = mejor.precio * cantidad;
    total += subtotal;
    items.push({
      ...indice.dataset.productos[item.indice],
      indice: item.indice,
      cantidad,
      precio: mejor.precio,
      subtotal,
      sucursal: porSuc.get(mejor.si),
      cadena: indice.cadenaPorId.get(porSuc.get(mejor.si).cadena),
    });
  }

  // Cuantas paradas hay que hacer para lograr ese total.
  const paradas = new Map();
  for (const it of items) {
    const clave = it.sucursal.indice;
    if (!paradas.has(clave))
      paradas.set(clave, { sucursal: it.sucursal, cadena: it.cadena, items: [], total: 0 });
    const p = paradas.get(clave);
    p.items.push(it);
    p.total += it.subtotal;
  }

  return {
    total,
    items,
    paradas: [...paradas.values()].sort((a, b) => b.total - a.total),
  };
}

export function formatearPesos(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}
