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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { File, Paths } from 'expo-file-system';
import { crearIndice, sucursalesCercanas } from './comparador';
import type { Dataset, Indice, ItemCarrito, SucursalCercana } from './comparador';

const CLAVE_CARRITO = 'carrito.v1';
const CLAVE_RADIO = 'radio.v1';
const ARCHIVO_CACHE = 'dataset.json';

/**
 * URL del dataset publicado por el ETL. Mientras este vacia, la app usa solo el
 * dataset del bundle y nunca sale a la red.
 * Ver README, seccion "Publicar el dataset".
 */
export const URL_DATASET = '';

/**
 * El dataset que viaja en el bundle. Siempre disponible, aunque envejezca.
 * De qué localidad es lo decide el ETL:
 *   node etl/build-dataset.mjs --localidad "MAR DEL PLATA" --salida movil/assets/dataset.json
 */
function datasetDelBundle(): Dataset {
  return require('../assets/dataset.json') as Dataset;
}

function archivoCache(): File {
  return new File(Paths.document, ARCHIVO_CACHE);
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

  useEffect(() => {
    let vivo = true;

    (async () => {
      const bundle = datasetDelBundle();
      const inicial = masFresco(bundle, await datasetCacheado());
      if (!vivo) return;
      setIndice(crearIndice(inicial));

      if (!URL_DATASET) return;
      setActualizando(true);
      const nuevo = await buscarActualizacion(inicial);
      if (!vivo) return;
      if (nuevo) setIndice(crearIndice(nuevo));
      setActualizando(false);
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return { indice, actualizando };
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
