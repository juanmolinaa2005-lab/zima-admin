import type { ChannelKind, LaunchChannel } from "./playbook";

export type CopyInput = {
  name: string;
  pitch: string;
  url: string;
};

type Template = (i: CopyInput) => string;

const BY_ID: Record<string, Template> = {
  producthunt: ({ name, pitch, url }) =>
    [
      `Nombre: ${name}`,
      `Tagline: ${pitch}`,
      `Enlace: ${url}`,
      "",
      "Primer comentario del maker:",
      `¡Hola, Product Hunt! Soy quien está detrás de ${name}.`,
      "",
      `Lo construí porque [el problema que tenías]. ${name} te ayuda a ${pitch.charAt(0).toLowerCase()}${pitch.slice(1)}.`,
      "",
      "Lo que puedes hacer hoy:",
      "• [Función 1]",
      "• [Función 2]",
      "• [Función 3]",
      "",
      "Me encantaría saber qué te parece y qué le falta. Respondo a todos los comentarios.",
    ].join("\n"),
  "show-hn": ({ name, pitch, url }) =>
    [
      `Show HN: ${name} – ${pitch}`,
      url,
      "",
      `Hola, HN. Hice ${name} porque [el problema concreto].`,
      "",
      "Cómo funciona por dentro: [stack y decisión técnica interesante].",
      "",
      "Lo que aún no hace bien: [limitación honesta].",
      "",
      "Agradezco cualquier crítica.",
    ].join("\n"),
  "reddit-sideproject": ({ name, pitch, url }) =>
    [
      `Título: Después de [X meses] lancé ${name}: ${pitch}`,
      "",
      "Hola a todos. Os cuento la historia corta:",
      "",
      "• El problema: [qué te pasaba].",
      "• Lo que probé antes: [alternativas y por qué no funcionaban].",
      `• Lo que construí: ${name}. ${pitch}.`,
      "• Lo que aprendí: [1 lección útil para otros makers].",
      "",
      `Si queréis probarlo: ${url}`,
      "Cualquier feedback, por duro que sea, me ayuda.",
    ].join("\n"),
  indiehackers: ({ name, pitch, url }) =>
    [
      `Título: Lancé ${name}. Estos son mis números del primer mes`,
      "",
      `${name}: ${pitch}. ${url}`,
      "",
      "• Usuarios: [X]",
      "• De pago: [X]",
      "• Ingresos: [X]",
      "• Lo que funcionó: [canal]",
      "• Lo que no: [canal]",
      "",
      "¿Qué haríais vosotros en mi lugar el próximo mes?",
    ].join("\n"),
  "x-bip": ({ name, pitch, url }) =>
    [
      `Hoy lanzo ${name}.`,
      "",
      `${pitch}.`,
      "",
      "Cómo lo construí y qué aprendí (hilo):",
      "",
      "2/ El problema: [una frase].",
      "",
      "3/ La primera versión: [captura del antes].",
      "",
      "4/ Lo que cambió todo: [aprendizaje].",
      "",
      `5/ Pruébalo gratis: ${url}`,
      "Un RT ayuda muchísimo a un proyecto independiente.",
    ].join("\n"),
  linkedin: ({ name, pitch, url }) =>
    [
      `Hace [X meses] empecé a construir algo por las noches. Hoy por fin lo lanzo: ${name}.`,
      "",
      `${pitch}.`,
      "",
      "Lo que aprendí por el camino:",
      "1. [Lección]",
      "2. [Lección]",
      "3. [Lección]",
      "",
      `Si te sirve, aquí lo tienes: ${url}`,
      "Y si conoces a alguien a quien le ayude, te agradezco mucho que lo compartas.",
    ].join("\n"),
  tiktok: ({ name, pitch }) =>
    [
      "Guion (15–30 s):",
      "",
      "0–2 s · Gancho: “[El problema dicho como lo diría tu cliente]”",
      "2–8 s · Muestra el problema en pantalla.",
      `8–20 s · Abre ${name} y enseña el resultado: ${pitch}.`,
      `20–30 s · Cierre: “Se llama ${name}, link en mi perfil.”`,
      "",
      "Texto en pantalla: [5 palabras con el beneficio]",
    ].join("\n"),
  "appstore-featuring": ({ name, pitch, url }) =>
    [
      `App: ${name}`,
      `Enlace: ${url}`,
      "",
      `Qué hace: ${pitch}.`,
      "",
      "Por qué es especial: [diseño, accesibilidad, uso de funciones nativas como widgets, Live Activities, App Intents].",
      "",
      "Fecha de lanzamiento o actualización: [fecha].",
      "Historia del desarrollador: [desarrollador independiente, motivo personal].",
    ].join("\n"),
};

const BY_KIND: Record<ChannelKind, Template> = {
  directory: ({ name, pitch, url }) =>
    [`Nombre: ${name}`, `Descripción corta: ${pitch}`, `Enlace: ${url}`, "", "Descripción larga:", `${name} te ayuda a [resultado]. [Para quién es]. [Qué lo hace diferente].`].join("\n"),
  community: ({ name, pitch, url }) =>
    [`Hice ${name}: ${pitch}.`, "", "La historia: [problema] → [lo que construí] → [lo que aprendí].", "", `Enlace: ${url}`, "¿Qué mejoraríais?"].join("\n"),
  social: ({ name, pitch, url }) => [`Hoy lanzo ${name}.`, "", `${pitch}.`, "", url].join("\n"),
  store: ({ name, pitch, url }) => [`App: ${name}`, `Qué hace: ${pitch}.`, `Enlace: ${url}`].join("\n"),
  press: ({ name, pitch, url }) =>
    [`Asunto: ${name}: ${pitch}`, "", "Hola, [nombre]:", "", `Soy [tu nombre], hice ${name}. ${pitch}.`, "Creo que encaja con tu audiencia porque [motivo].", "", `Demo: ${url}`, "", "Gracias por tu tiempo."].join("\n"),
};

export function channelCopy(channel: LaunchChannel, input: CopyInput): string {
  const template = BY_ID[channel.id] ?? BY_KIND[channel.kind];
  return template(input);
}
