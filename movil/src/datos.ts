/**
 * Carga del dataset y estado persistente del carrito.
 *
 * El dataset viaja dentro del bundle como piso garantizado, pero la app intenta
 * mantenerse al dia sola: al arrancar consulta la copia publicada por el ETL y,
 * si hay una corrida mas nueva, la baja y la deja cacheada en disco. Si algo de
 * eso falla —sin red, sin permisos, JSON invalido— sigue andando con lo que ya
 * tenia. Nunca se queda sin datos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { crearIndice, sucursalesCercanas } from './comparador';
import type { Dataset, Indice, ItemCarrito, SucursalCercana } from './comparador';

const CLAVE_CARRITO = 'carrito.v1';
const CLAVE_RADIO = 'radio.v1';
const ARCHIVO_CACHE = 'dataset.json';

/**
 * De donde se bajan los precios actualizados. Mientras este vacio, la app usa
 * solo el dataset del bundle y nunca sale a la red.
 *
 * Son dos archivos a proposito: `version.json` pesa unos cientos de bytes y
 * `dataset.json` diez megas. Primero se consulta la version, y el dataset se
 * baja unicamente cuando hay datos mas nuevos que los que ya tenemos. Sin esa
 * separacion, abrir la app costaria 10 MB cada vez.
 */
const BASE_PUBLICACION =
  'https://github.com/Axel0297/changuito/releases/latest/download';

export const URL_VERSION = `${BASE_PUBLICACION}/version.json`;
export const URL_DATASET = `${BASE_PUBLICACION}/dataset.json`;

/**
 * El dataset que viaja con la app. Siempre disponible, aunque envejezca.
 *
 * Va como asset (.dat) y no como .json a proposito: Metro inlinea los .json
 * dentro del bundle, que despues se compila a bytecode de Hermes, y 8 MB de
 * datos ahi adentro rompen el motor — la app abria y moria con "Cannot convert
 * undefined value to object". Como asset se lee del disco en runtime y no pasa
 * por el compilador.
 *
 * De que localidad es lo decide el ETL:
 *   node etl/build-dataset.mjs --localidad "MAR DEL PLATA" --salida movil/assets/dataset.dat
 */
async function datasetDelBundle(): Promise<Dataset> {
  const asset = Asset.fromModule(require('../assets/dataset.dat'));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('el asset del dataset no quedo disponible');
  return JSON.parse(await leerAsset(uri)) as Dataset;
}

/**
 * En el telefono el asset queda como archivo y se lee con expo-file-system; en
 * el navegador no hay filesystem —`File` revienta con "validatePath is not a
 * function"— y el asset es una URL comun, asi que se baja con fetch.
 */
async function leerAsset(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('no pude leer el asset (' + res.status + ')');
    return res.text();
  }
  return await new File(uri).text();
}

function archivoCache(): File {
  return new File(Paths.document, ARCHIVO_CACHE);
}

/**
 * Corta cualquier promesa que se cuelgue.
 *
 * Hace falta de verdad: la app se quedaba en la pantalla de carga para siempre
 * porque una lectura de disco no resolvia nunca. Un `await` que no vuelve no
 * lanza excepcion, asi que el try/catch no lo agarra.
 */
function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promesa,
    new Promise<null>((resolver) => setTimeout(() => resolver(null), ms)),
  ]);
}

function mensajeDeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Copia descargada en corridas anteriores, si quedo alguna sana. */
async function datasetCacheado(): Promise<Dataset | null> {
  try {
    const f = archivoCache();
    if (!f.exists) return null;
    // `text()` es sincrono en unas versiones y asincrono en otras; await sirve
    // para las dos.
    const crudo = await f.text();
    const d = JSON.parse(crudo) as Dataset;
    return d?.productos?.length ? d : null;
  } catch {
    return null;
  }
}

/** El mas fresco de los dos, comparando la fecha de los datos. */
function masFresco(a: Dataset, b: Dataset | null): Dataset {
  if (!b) return a;
  return b.fecha_datos > a.fecha_datos ? b : a;
}

/**
 * Baja el dataset publicado si es mas nuevo que el que ya tenemos.
 * Devuelve null cuando no hay nada mejor que lo actual.
 */
async function buscarActualizacion(actual: Dataset): Promise<Dataset | null> {
  if (!URL_DATASET) return null;
  try {
    // Primero el archivito de version: si no hay nada nuevo, nos ahorramos
    // bajar los 10 MB del dataset.
    const resVersion = await fetch(URL_VERSION, { cache: 'no-store' });
    if (!resVersion.ok) return null;
    const version = (await resVersion.json()) as { fecha_datos?: string };
    if (!version?.fecha_datos || !(version.fecha_datos > actual.fecha_datos)) return null;

    const res = await fetch(URL_DATASET);
    if (!res.ok) return null;
    const nuevo = (await res.json()) as Dataset;
    if (!nuevo?.productos?.length) return null;
    if (!(nuevo.fecha_datos > actual.fecha_datos)) return null;

    // Se guarda recien despues de validar, para no dejar basura en el cache.
    try {
      const f = archivoCache();
      await f.write(JSON.stringify(nuevo));
    } catch {
      // sin cache igual sirve para esta sesion
    }
    return nuevo;
  } catch {
    return null;
  }
}

/**
 * Indexa el dataset y lo mantiene actualizado.
 * `actualizando` sirve para avisar en pantalla que se esta buscando algo mas nuevo.
 */
export function useIndice() {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      // 1. Lo primero es tener precios. Se prueba el cache (mas fresco) y el
      //    asset que vino con la app, y se usa el que llegue en buen estado.
      let base: Dataset | null = null;
      try {
        const cacheado = await conLimite(datasetCacheado(), 8000);
        const delBundle = await conLimite(datasetDelBundle(), 20000);

        if (!delBundle && !cacheado) {
          throw new Error('no pude leer ni la copia guardada ni la que trae la app');
        }
        base =
          cacheado && (!delBundle || cacheado.fecha_datos > delBundle.fecha_datos)
            ? cacheado
            : delBundle!;

        if (!vivo) return;
        setIndice(crearIndice(base));
      } catch (e) {
        if (vivo) setError('No pude abrir los precios: ' + mensajeDeError(e));
        return;
      }

      // 2. Recien con la app usable se sale a buscar algo mas nuevo.
      try {
        if (!URL_DATASET) return;
        if (vivo) setActualizando(true);
        const nuevo = await conLimite(buscarActualizacion(base), 90000);
        if (vivo && nuevo) setIndice(crearIndice(nuevo));
      } catch {
        // Quedarse con datos viejos es molesto; romper la app, peor.
      } finally {
        if (vivo) setActualizando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return { indice, actualizando, error };
}

/**
 * Ubicacion del usuario. Si no da permiso, cae al centro de Trelew: la app
 * sigue siendo util, solo que las distancias son desde el centro.
 */
export function useUbicacion(indice: Indice | null) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsActivo, setGpsActivo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!vivo) return;
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsActivo(true);
      } catch {
        // sin GPS seguimos con el centro de Trelew
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const efectivas = coords ?? (indice ? indice.dataset.centro : null);
  return { coords: efectivas, gpsActivo };
}

export function useSucursales(indice: Indice | null, radioKm: number) {
  const { coords, gpsActivo } = useUbicacion(indice);

  const sucursales = useMemo<SucursalCercana[]>(() => {
    if (!indice || !coords) return [];
    return sucursalesCercanas(indice, { lat: coords.lat, lon: coords.lon, radioKm });
  }, [indice, coords, radioKm]);

  return { sucursales, gpsActivo };
}

/**
 * Carrito persistido: si se pierde al cerrar la app, no sirve para nada.
 *
 * Se guarda por EAN, no por indice: los indices se renumeran cada vez que el
 * ETL regenera el dataset, asi que persistirlos haria que el carrito de ayer
 * apunte a productos distintos hoy.
 */
export function useCarrito(indice: Indice | null) {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!indice) return;
    AsyncStorage.getItem(CLAVE_CARRITO)
      .then((raw) => {
        if (!raw) return;
        const guardado: { ean: string; cantidad: number }[] = JSON.parse(raw);
        const resueltos: ItemCarrito[] = [];
        for (const item of guardado) {
          const i = indice.porEan.get(item.ean);
          // Un producto que ya no figura en el dataset simplemente se cae.
          if (i !== undefined) resueltos.push({ indice: i, cantidad: item.cantidad });
        }
        setCarrito(resueltos);
      })
      .catch(() => {})
      .finally(() => setListo(true));
  }, [indice]);

  useEffect(() => {
    if (!listo || !indice) return;
    const guardable = carrito.map((i) => ({
      ean: indice.dataset.productos[i.indice].ean,
      cantidad: i.cantidad,
    }));
    AsyncStorage.setItem(CLAVE_CARRITO, JSON.stringify(guardable)).catch(() => {});
  }, [carrito, listo, indice]);

  const agregar = useCallback((indiceProducto: number) => {
    setCarrito((prev) =>
      prev.some((i) => i.indice === indiceProducto)
        ? prev.map((i) =>
            i.indice === indiceProducto ? { ...i, cantidad: i.cantidad + 1 } : i
          )
        : [...prev, { indice: indiceProducto, cantidad: 1 }]
    );
  }, []);

  const cambiarCantidad = useCallback((indiceProducto: number, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.indice === indiceProducto ? { ...i, cantidad: i.cantidad + delta } : i
        )
        .filter((i) => i.cantidad > 0)
    );
  }, []);

  const quitar = useCallback((indiceProducto: number) => {
    setCarrito((prev) => prev.filter((i) => i.indice !== indiceProducto));
  }, []);

  const vaciar = useCallback(() => setCarrito([]), []);

  return { carrito, agregar, cambiarCantidad, quitar, vaciar, listo };
}

export function useRadio(inicial = 5) {
  const [radio, setRadio] = useState(inicial);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_RADIO)
      .then((raw) => {
        if (raw) setRadio(Number(raw));
      })
      .catch(() => {});
  }, []);

  const cambiar = useCallback((km: number) => {
    setRadio(km);
    AsyncStorage.setItem(CLAVE_RADIO, String(km)).catch(() => {});
  }, []);

  return [radio, cambiar] as const;
}
