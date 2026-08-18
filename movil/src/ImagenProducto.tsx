/**
 * Imagen de un producto.
 *
 * Primero intenta la foto real de Open Food Facts, que indexa por EAN igual que
 * el dataset. Pero OFF es una base de *alimentos*: la perfumeria y la limpieza
 * no estan, y de los alimentos falta bastante. En una muestra de productos de
 * Trelew habia foto para 1 de cada 5.
 *
 * Por eso el que manda es el dibujo: cada producto tiene su ilustracion segun
 * lo que es, y la foto aparece por arriba cuando existe. Nunca queda un hueco.
 */
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconoProducto, colorDeEtiqueta, detectarCategoria } from './iconos';
import { C } from './tema';

// Se consulta una vez por EAN y queda cacheado; '' significa "no tiene foto".
const enMemoria = new Map<string, string>();

async function buscarFotoDeProducto(ean: string): Promise<string> {
  if (enMemoria.has(ean)) return enMemoria.get(ean)!;

  const clave = 'off.img.' + ean;
  try {
    const guardado = await AsyncStorage.getItem(clave);
    if (guardado !== null) {
      enMemoria.set(ean, guardado);
      return guardado;
    }
  } catch {
    // seguimos y preguntamos a la red
  }

  let url = '';
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=image_front_small_url`,
      { headers: { 'User-Agent': 'precios-trelew/0.1 (comparador de precios)' } }
    );
    if (res.ok) {
      const j = await res.json();
      url = j?.product?.image_front_small_url ?? '';
    }
  } catch {
    // sin red no hay foto, y el dibujo alcanza
  }

  enMemoria.set(ean, url);
  AsyncStorage.setItem(clave, url).catch(() => {});
  return url;
}

interface Props {
  ean: string;
  desc: string;
  tamano?: number;
  /**
   * Sale a buscar la foto real. Se activa donde hay pocos productos en pantalla
   * (el carrito, el escaner); en una lista de busqueda serian decenas de
   * consultas de golpe, asi que ahi va solo el dibujo.
   */
  buscarFoto?: boolean;
}

export function ImagenProducto({ ean, desc, tamano = 52, buscarFoto = false }: Props) {
  const [foto, setFoto] = useState('');

  useEffect(() => {
    if (!buscarFoto) return;
    let vivo = true;
    buscarFotoDeProducto(ean).then((url) => {
      if (vivo) setFoto(url);
    });
    return () => {
      vivo = false;
    };
  }, [ean, buscarFoto]);

  const color = colorDeEtiqueta(ean);
  const categoria = detectarCategoria(desc);

  return (
    <View style={[i.marco, { width: tamano, height: tamano, borderColor: color }]}>
      {foto ? (
        <Image source={{ uri: foto }} style={i.foto} resizeMode="contain" />
      ) : (
        <IconoProducto categoria={categoria} color={color} tamano={tamano * 0.72} />
      )}
    </View>
  );
}

const i = StyleSheet.create({
  marco: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: C.tarjeta,
    overflow: 'hidden',
  },
  foto: { width: '100%', height: '100%' },
});
