// Sistema de créditos por operador, usando Upstash Redis (conectado vía Vercel
// Marketplace Storage). Cada operador tiene un "código de acceso" corto (lo genera
// el administrador, no requiere que el operador se registre con email/contraseña)
// y un saldo de créditos. Cada descripción generada con IA consume 1 crédito.
//
// Si no hay créditos (o no se mandó código), la app sigue funcionando gratis con el
// generador local por reglas — nunca se corta el servicio por falta de saldo.

import { Redis } from "@upstash/redis";

const PREFIJO = "operador:";

function obtenerCliente() {
  // Redis.fromEnv() busca UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.
  // Si todavía no se conectó la base de datos en Vercel, devolvemos null en vez de
  // romper: todo el sistema de créditos queda "apagado" y la app sigue funcionando
  // en modo gratis por reglas.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

export async function obtenerOperador(codigo) {
  const redis = obtenerCliente();
  if (!redis || !codigo) return null;
  const datos = await redis.get(`${PREFIJO}${codigo}`);
  return datos || null; // { nombre, creditos } o null si no existe
}

export async function descontarCredito(codigo) {
  const redis = obtenerCliente();
  if (!redis || !codigo) return null;

  const operador = await obtenerOperador(codigo);
  if (!operador || operador.creditos <= 0) return null;

  const actualizado = { ...operador, creditos: operador.creditos - 1 };
  await redis.set(`${PREFIJO}${codigo}`, actualizado);
  return actualizado;
}

export async function guardarOperador(codigo, nombre, creditos) {
  const redis = obtenerCliente();
  if (!redis) throw new Error("La base de datos de créditos no está conectada todavía.");

  const actual = await obtenerOperador(codigo);
  const nuevo = {
    nombre: nombre || actual?.nombre || codigo,
    creditos: creditos !== undefined && creditos !== null ? Number(creditos) : actual?.creditos || 0,
  };
  await redis.set(`${PREFIJO}${codigo}`, nuevo);
  return nuevo;
}

export async function listarOperadores() {
  const redis = obtenerCliente();
  if (!redis) return [];

  const claves = await redis.keys(`${PREFIJO}*`);
  const operadores = [];
  for (const clave of claves) {
    const datos = await redis.get(clave);
    if (datos) operadores.push({ codigo: clave.replace(PREFIJO, ""), ...datos });
  }
  return operadores.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function eliminarOperador(codigo) {
  const redis = obtenerCliente();
  if (!redis || !codigo) return;
  await redis.del(`${PREFIJO}${codigo}`);
}
