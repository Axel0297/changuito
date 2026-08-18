/**
 * ETL: dataset abierto SEPA (nacional, ~336 MB/dia) -> dataset local de una zona.
 *
 * El ZIP diario contiene un ZIP por cadena, y cada uno trae comercio.csv,
 * sucursales.csv y productos.csv, delimitados por "|".
 *
 * Trampas del formato:
 *  - En productos.csv el header esta corrido respecto a los datos: el EAN real
 *    viene en la columna "id_producto" (indice 3), no en "productos_ean".
 *  - comercio.csv trae una fila por bandera. Una misma empresa opera formatos
 *    con precios distintos (Carrefour: Express/Market/Maxi/Hiper), asi que hay
 *    que mapear por id_bandera y no quedarse con la primera fila.
 *
 * Uso:
 *   node etl/build-dataset.mjs                          # Trelew, 60 km
 *   node etl/build-dataset.mjs --localidad "MAR DEL PLATA"
 *   node etl/build-dataset.mjs --centro -34.60,-58.38 --nombre "Buenos Aires"
 *   node etl/build-dataset.mjs --listar                 # que localidades hay
 *
 * Flags: --radio N | --cache | --salida ruta.json
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import AdmZip from 'adm-zip';

const CENTRO_POR_DEFECTO = { lat: -43.253, lon: -65.309, nombre: 'Trelew' };
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'data');
const WORK_DIR = path.join(os.tmpdir(), 'precios-app-etl');

const argv = process.argv.slice(2);
const flag = (nombre) => {
  const i = argv.indexOf('--' + nombre);
  return i >= 0 ? argv[i + 1] : null;
};
const RADIO_KM = Number(flag('radio')) || 60;
const USE_CACHE = argv.includes('--cache');
const LISTAR = argv.includes('--listar');
const LOCALIDAD = flag('localidad');
const CENTRO_MANUAL = flag('centro');
const NOMBRE_MANUAL = flag('nombre');
const SALIDA = flag('salida');

const log = (...a) => console.log('[etl]', ...a);

/** Distancia haversine en km. */
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Para comparar nombres de localidad sin pelearse con acentos ni mayusculas. */
function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function aSlug(texto) {
  return normalizar(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ultima fecha dd/mm/aaaa que aparece en la leyenda de una promo, que es la de
 * fin de vigencia. Las leyendas no tienen un formato unico ("Promo A valida
 * desde el 11/08/2026 hasta 18/08/2026", "25% de descuento... Hasta el 23/08"),
 * pero en todas la ultima fecha es la que cierra. Si no hay ninguna, null: se
 * muestra igual, sin poder avisar cuando vence.
 */
function vigenciaHasta(leyenda) {
  const fechas = (leyenda || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g);
  if (!fechas?.length) return null;
  const [d, m, a] = fechas[fechas.length - 1].split('/');
  return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * El portal rechaza con 403 a quien no parece un navegador: Node manda su
 * propio User-Agent y eso alcanza para que corte la conexion (se ve al correr
 * el ETL desde un runner de CI).
 */
const CABECERAS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'es-AR,es;q=0.9',
};

/** Resuelve el ZIP del dia mas reciente publicado. */
async function resolverRecurso() {
  const url = 'https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios';
  const res = await fetch(url, { headers: CABECERAS });
  if (!res.ok) throw new Error('CKAN respondio ' + res.status);
  const { result } = await res.json();
  const zips = result.resources
    .filter((r) => r.format === 'ZIP')
    .sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
  if (!zips.length) throw new Error('El dataset no expone recursos ZIP');
  return zips[0];
}

async function descargar(recurso) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const destino = path.join(WORK_DIR, path.basename(recurso.url));
  if (USE_CACHE && fs.existsSync(destino)) {
    log('usando cache: ' + destino);
    return destino;
  }
  log('descargando ' + recurso.name + ' (' + (recurso.size / 1e6).toFixed(0) + ' MB)...');
  const res = await fetch(recurso.url, { headers: CABECERAS });
  if (!res.ok) throw new Error('descarga fallo con ' + res.status);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(destino));
  return destino;
}

/** Lee un CSV pipe-delimited desde disco, linea por linea. */
async function leerCsv(archivo, onFila) {
  const rl = readline.createInterface({
    input: fs.createReadStream(archivo, 'utf8'),
    crlfDelay: Infinity,
  });
  let primera = true;
  for await (const linea of rl) {
    if (primera) {
      primera = false;
      continue;
    }
    if (!linea.trim()) continue;
    onFila(linea.split('|'));
  }
}

/** Extrae el ZIP nacional y devuelve un directorio por cadena. */
function extraerCadenas(zipPath) {
  const extraidos = path.join(WORK_DIR, 'extraido');
  fs.rmSync(extraidos, { recursive: true, force: true });
  fs.mkdirSync(extraidos, { recursive: true });

  const externo = new AdmZip(zipPath);
  const dirs = [];
  for (const entry of externo.getEntries()) {
    if (entry.isDirectory || !entry.entryName.endsWith('.zip')) continue;
    if (entry.header.size === 0) continue; // algunas cadenas publican vacio
    const zipCadena = path.join(extraidos, path.basename(entry.entryName));
    fs.writeFileSync(zipCadena, entry.getData());
    const dir = zipCadena.replace(/\.zip$/, '');
    fs.mkdirSync(dir, { recursive: true });
    new AdmZip(zipCadena).extractAllTo(dir, true);
    if (fs.existsSync(path.join(dir, 'sucursales.csv'))) dirs.push(dir);
  }
  return dirs;
}

/**
 * Primera pasada: todas las sucursales del pais con sus banderas.
 * Son ~3.000, asi que entra comodo en memoria y evita adivinar coordenadas.
 */
async function leerSucursalesDelPais(dirs) {
  const sucursales = [];
  for (const dir of dirs) {
    const banderas = new Map();
    let razonSocial = null;
    await leerCsv(path.join(dir, 'comercio.csv'), (c) => {
      if (!c[1] || !c[4]?.trim()) return; // el CSV cierra con filas vacias
      razonSocial ??= c[3];
      banderas.set(c[1], {
        id: c[0] + '-' + c[1],
        nombre: c[4].trim(),
        razon_social: c[3],
        url: c[5],
      });
    });
    if (banderas.size === 0) continue;

    await leerCsv(path.join(dir, 'sucursales.csv'), (c) => {
      const lat = parseFloat(c[7]);
      const lon = parseFloat(c[8]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const bandera = banderas.get(c[1]);
      if (!bandera) return;
      sucursales.push({
        dir,
        razonSocial,
        bandera,
        idSucursal: c[2],
        id: c[0] + '-' + c[2],
        nombre: (c[3] || '').trim(),
        tipo: c[4],
        direccion: ((c[5] || '') + ' ' + (c[6] || '')).trim(),
        localidad: (c[12] || '').trim(),
        provincia: c[13],
        lat,
        lon,
        horarios: {
          lun: c[14], mar: c[15], mie: c[16], jue: c[17],
          vie: c[18], sab: c[19], dom: c[20],
        },
      });
    });
  }
  return sucursales;
}

/** Localidades ordenadas por cuantas banderas distintas tienen. */
function resumirLocalidades(sucursales) {
  const porLoc = new Map();
  for (const s of sucursales) {
    const clave = normalizar(s.localidad);
    if (!clave) continue;
    if (!porLoc.has(clave)) {
      porLoc.set(clave, { nombre: s.localidad, provincia: s.provincia, banderas: new Set(), n: 0 });
    }
    const e = porLoc.get(clave);
    e.banderas.add(s.bandera.id);
    e.n++;
  }
  return [...porLoc.entries()]
    .map(([clave, e]) => ({ clave, ...e, banderas: e.banderas.size }))
    .sort((a, b) => b.banderas - a.banderas || b.n - a.n);
}

/**
 * El centro de la zona. Si se pide por localidad, sale del promedio de sus
 * propias sucursales: el dataset ya trae coordenadas, no hace falta geocoder.
 */
function resolverCentro(sucursales) {
  if (CENTRO_MANUAL) {
    const [lat, lon] = CENTRO_MANUAL.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('--centro espera "lat,lon", por ejemplo -34.60,-58.38');
    }
    return { lat, lon, nombre: NOMBRE_MANUAL || `${lat},${lon}` };
  }

  if (LOCALIDAD) {
    const buscado = normalizar(LOCALIDAD);
    const enLocalidad = sucursales.filter((s) => normalizar(s.localidad) === buscado);
    if (enLocalidad.length === 0) {
      const parecidas = resumirLocalidades(sucursales)
        .filter((l) => l.clave.includes(buscado) || buscado.includes(l.clave))
        .slice(0, 8);
      const pista = parecidas.length
        ? '\n  ¿Quisiste decir?: ' + parecidas.map((l) => l.nombre).join(' · ')
        : '\n  Probá --listar para ver las localidades disponibles.';
      throw new Error(`No hay sucursales en "${LOCALIDAD}".` + pista);
    }
    const lat = enLocalidad.reduce((a, s) => a + s.lat, 0) / enLocalidad.length;
    const lon = enLocalidad.reduce((a, s) => a + s.lon, 0) / enLocalidad.length;
    return { lat, lon, nombre: NOMBRE_MANUAL || enLocalidad[0].localidad };
  }

  return { ...CENTRO_POR_DEFECTO };
}

async function main() {
  const recurso = await resolverRecurso();
  const fechaDatos = recurso.last_modified.slice(0, 10);
  log('dataset del ' + fechaDatos + ' (' + recurso.name + ')');

  const zipPath = await descargar(recurso);
  log('extrayendo ZIP nacional...');
  const dirs = extraerCadenas(zipPath);
  log(dirs.length + ' cadenas con datos');

  const delPais = await leerSucursalesDelPais(dirs);

  if (LISTAR) {
    const localidades = resumirLocalidades(delPais);
    const utiles = localidades.filter((l) => l.banderas >= 2);
    console.log(`\n${localidades.length} localidades con sucursales; ${utiles.length} con 2+ cadenas.\n`);
    console.log('  ' + 'LOCALIDAD'.padEnd(32) + 'PROV'.padEnd(7) + 'CADENAS  SUCURSALES');
    for (const l of utiles) {
      console.log(
        '  ' + l.nombre.slice(0, 31).padEnd(32) + (l.provincia || '?').padEnd(7) +
        String(l.banderas).padStart(4) + String(l.n).padStart(12)
      );
    }
    console.log('\nUsalo asi:  node etl/build-dataset.mjs --localidad "NOMBRE"');
    return;
  }

  const centro = resolverCentro(delPais);
  log(`centro: ${centro.nombre} (${centro.lat.toFixed(4)}, ${centro.lon.toFixed(4)}) · radio ${RADIO_KM} km`);

  // Sucursales dentro del radio, agrupadas por cadena para leer productos una vez.
  const cercanas = delPais
    .map((s) => ({ ...s, distancia_km: Number(distanciaKm(centro.lat, centro.lon, s.lat, s.lon).toFixed(1)) }))
    .filter((s) => s.distancia_km <= RADIO_KM);

  if (cercanas.length === 0) {
    throw new Error(`No hay ninguna sucursal a menos de ${RADIO_KM} km de ${centro.nombre}. Probá con un radio mayor.`);
  }

  const cadenas = [];
  const sucursales = [];
  const productosIdx = new Map(); // ean -> indice en `productos`
  const productos = [];
  const precios = [];
  // Las leyendas de promo se repiten miles de veces ("Promo A valida desde...").
  // Se guardan una sola vez y en cada precio va el indice.
  const leyendasIdx = new Map();
  const leyendas = [];

  const porDirectorio = new Map();
  for (const s of cercanas) {
    if (!porDirectorio.has(s.dir)) porDirectorio.set(s.dir, []);
    porDirectorio.get(s.dir).push(s);
  }

  for (const [dir, suyas] of porDirectorio) {
    const indicePorSucursal = new Map(); // id_sucursal -> indice global
    const banderasUsadas = new Set();

    for (const s of suyas) {
      indicePorSucursal.set(s.idSucursal, sucursales.length);
      banderasUsadas.add(s.bandera.id);
      sucursales.push({
        id: s.id,
        cadena: s.bandera.id,
        nombre: s.nombre,
        tipo: s.tipo,
        direccion: s.direccion,
        localidad: s.localidad,
        lat: s.lat,
        lon: s.lon,
        distancia_km: s.distancia_km,
        horarios: s.horarios,
      });
    }

    const nombres = [...new Set(suyas.map((s) => s.bandera.nombre))];
    log(suyas[0].razonSocial + ' [' + nombres.join(', ') + ']: ' + suyas.length + ' sucursales');
    for (const id of banderasUsadas) {
      cadenas.push(suyas.find((s) => s.bandera.id === id).bandera);
    }

    let filas = 0;
    await leerCsv(path.join(dir, 'productos.csv'), (c) => {
      const sucIdx = indicePorSucursal.get(c[2]);
      if (sucIdx === undefined) return;
      const ean = c[3];
      if (!/^\d{8,14}$/.test(ean)) return;
      const precio = parseFloat(c[9]);
      if (!(precio > 0)) return;

      let pIdx = productosIdx.get(ean);
      if (pIdx === undefined) {
        pIdx = productos.length;
        productosIdx.set(ean, pIdx);
        productos.push({
          ean,
          desc: c[5],
          cant: parseFloat(c[6]) || null,
          unidad: c[7] || null,
          marca: c[8] || null,
        });
      }
      const precioRef = parseFloat(c[10]);
      const fila = [sucIdx, pIdx, precio, precioRef > 0 ? precioRef : null, c[12] || null];

      // Promocion declarada por la cadena. Solo vale si baja el precio de lista:
      // hay filas donde el campo repite el precio o viene mas caro.
      //
      // Hay dos slots de promo y no todas las cadenas usan el primero: DIA
      // publica casi todo en promo2. Se toma la mas conveniente de las dos.
      const promo1 = parseFloat(c[13]);
      const promo2 = parseFloat(c[15]);
      const usa2 =
        promo2 > 0 && promo2 < precio && !(promo1 > 0 && promo1 < precio && promo1 <= promo2);
      const promo = usa2 ? promo2 : promo1;

      if (promo > 0 && promo < precio) {
        const texto = ((usa2 ? c[16] : c[14]) || '').trim();
        let lIdx = leyendasIdx.get(texto);
        if (lIdx === undefined) {
          lIdx = leyendas.length;
          leyendasIdx.set(texto, lIdx);
          leyendas.push({ texto, hasta: vigenciaHasta(texto) });
        }
        fila.push(promo, lIdx);
      }

      precios.push(fila);
      filas++;
    });
    log('  ' + filas.toLocaleString('es-AR') + ' precios');
  }

  // Cuantas cadenas ofrecen cada producto: sirve para priorizar lo comparable.
  const cadenaPorSucursal = sucursales.map((s) => s.cadena);
  const cadenasPorProducto = new Map();
  for (const [sucIdx, pIdx] of precios) {
    let set = cadenasPorProducto.get(pIdx);
    if (!set) cadenasPorProducto.set(pIdx, (set = new Set()));
    set.add(cadenaPorSucursal[sucIdx]);
  }
  productos.forEach((p, i) => {
    p.cadenas = cadenasPorProducto.get(i)?.size ?? 0;
  });

  const dataset = {
    version: 1,
    generado: new Date().toISOString(),
    fecha_datos: fechaDatos,
    centro: { ...centro, radio_km: RADIO_KM },
    cadenas,
    sucursales,
    productos,
    leyendas,
    // [indice_sucursal, indice_producto, precio, precio_referencia, unidad_referencia]
    // y, cuando la cadena declara promocion: (..., precio_promo, indice_leyenda)
    precios,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = SALIDA
    ? path.resolve(SALIDA)
    : path.join(OUT_DIR, aSlug(centro.nombre) + '.json');
  const json = JSON.stringify(dataset);
  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(jsonPath + '.gz', zlib.gzipSync(json, { level: 9 }));

  const comparables = productos.filter((p) => p.cadenas >= 2).length;
  const banderas = new Set(cadenas.map((c) => c.id)).size;
  log('---');
  log('sucursales:  ' + sucursales.length + ' de ' + banderas + ' banderas');
  log('productos:   ' + productos.length.toLocaleString('es-AR') +
      ' (' + comparables.toLocaleString('es-AR') + ' en 2+ cadenas)');
  log('precios:     ' + precios.length.toLocaleString('es-AR'));
  const conPromo = precios.filter((p) => p.length > 5).length;
  log('promos:      ' + conPromo.toLocaleString('es-AR') +
      ' (' + leyendas.length + ' leyendas distintas)');
  log('salida:      ' + path.relative(ROOT, jsonPath) + ' · ' +
      (json.length / 1e6).toFixed(1) + ' MB json / ' +
      (fs.statSync(jsonPath + '.gz').size / 1e6).toFixed(1) + ' MB gzip');
}

main().catch((e) => {
  console.error('[etl] fallo:', e.message || e);
  process.exit(1);
});
