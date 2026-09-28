import type {
  AppDemoSpec,
  AppRuntimeState,
  UiNode,
} from "@/lib/creator/app-demo";
import type { ProductAdapter, ProductSchema } from "../types";

const ACCENT = "#2563eb";

function listItems(state: AppRuntimeState): {
  id: string;
  title: string;
  sub?: string;
}[] {
  const title = String(state.values.reminderTitle || "").trim();
  const saved = Boolean(state.values.reminderSaved) || title.length > 0;
  const when = String(state.values.reminderWhen || "").trim();
  const done = Boolean(state.values.reminderDone);
  const extra = saved && title
    ? [
        {
          id: "reminder_item_new",
          title: done ? `✓ ${title}` : title,
          sub: when || "Hoy",
        },
      ]
    : [];
  return [
    ...extra,
    { id: "reminder_item_rent", title: "Pagar renta", sub: "Mañana · 9:00" },
    { id: "reminder_item_call", title: "Llamar a mamá", sub: "Viernes · 18:00" },
  ];
}

export function buildMounAppSpec(state?: AppRuntimeState): AppDemoSpec {
  const values = state?.values || {};
  const runtime: AppRuntimeState = {
    screen: state?.screen || "home",
    history: state?.history || [],
    values: {
      reminderTitle: "",
      reminderWhen: "",
      reminderSaved: false,
      reminderDone: false,
      searchQuery: "",
      reminderCount: 2,
      ...values,
    },
  };
  const items = listItems(runtime);
  runtime.values.reminderCount = items.length;
  const query = String(runtime.values.searchQuery || "").trim().toLowerCase();
  const memories = [
    { id: "memory_rent", title: "Pagar renta", sub: "Completado · hace 2d" },
    { id: "memory_meds", title: "Tomar medicamento", sub: "Completado · hace 5d" },
    { id: "memory_hw", title: "Entregar tarea", sub: "Completado · hace 1s" },
  ].filter((m) => !query || m.title.toLowerCase().includes(query));

  const homeNodes: UiNode[] = [
    {
      type: "navbar",
      id: "home_navbar",
      title: "Reminders",
    },
    {
      type: "title",
      id: "home_title",
      text: "Hoy",
      sub: "Di lo que tienes que hacer.",
    },
    {
      type: "stat",
      id: "home_count",
      label: "Activos",
      value: String(items.length),
      bind: "reminderCount",
    },
    {
      type: "list",
      id: "reminder_list",
      items: items.map((it) => ({
        ...it,
        action: { type: "navigate" as const, screen: "reminder_detail" },
      })),
    },
    {
      type: "button",
      id: "new_reminder_button",
      label: "Nuevo recordatorio",
      variant: "primary",
      action: { type: "navigate", screen: "create_reminder" },
    },
  ];

  return {
    appName: "Reminders",
    tagline: "Crea un recordatorio en segundos",
    cta: "Probar",
    accent: ACCENT,
    background: "#ffffff",
    kind: "functional",
    summary:
      "App de recordatorios: lista en home, crear con título y hora, completar y buscar en memorias.",
    startScreen: "home",
    tabs: [
      { id: "home_tab", label: "Home", screen: "home" },
      { id: "create_tab", label: "Nuevo", screen: "create_reminder" },
      { id: "memories_tab", label: "Memorias", screen: "memories" },
    ],
    state: { ...runtime.values },
    screens: [
      {
        id: "home",
        name: "Home",
        imageUrl: "",
        background: "#ffffff",
        hotspots: [],
        nodes: homeNodes,
      },
      {
        id: "create_reminder",
        name: "Nuevo recordatorio",
        imageUrl: "",
        background: "#ffffff",
        hotspots: [],
        nodes: [
          {
            type: "navbar",
            id: "create_navbar",
            title: "Nuevo",
            back: { type: "back" },
          },
          {
            type: "title",
            id: "create_title",
            text: "¿Qué quieres recordar?",
            sub: "Título y cuándo.",
          },
          {
            type: "input",
            id: "reminder_input",
            bind: "reminderTitle",
            placeholder: "Ej. Entregar la tarea",
          },
          {
            type: "input",
            id: "reminder_when_input",
            bind: "reminderWhen",
            placeholder: "Mañana a las 8:00",
          },
          {
            type: "button",
            id: "save_reminder_button",
            label: "Guardar",
            variant: "primary",
            action: { type: "navigate", screen: "home" },
          },
        ],
      },
      {
        id: "reminder_detail",
        name: "Detalle",
        imageUrl: "",
        background: "#ffffff",
        hotspots: [],
        nodes: [
          {
            type: "navbar",
            id: "detail_navbar",
            title: "Recordatorio",
            back: { type: "back" },
          },
          {
            type: "title",
            id: "detail_title",
            text: String(runtime.values.reminderTitle || "Pagar renta"),
            sub: String(runtime.values.reminderWhen || "Mañana · 9:00"),
          },
          {
            type: "button",
            id: "complete_reminder_button",
            label: runtime.values.reminderDone ? "Completado" : "Marcar hecho",
            variant: "primary",
            action: { type: "toggle", key: "reminderDone" },
          },
          {
            type: "button",
            id: "delete_reminder_button",
            label: "Eliminar",
            variant: "ghost",
            action: { type: "navigate", screen: "home" },
          },
        ],
      },
      {
        id: "memories",
        name: "Memorias",
        imageUrl: "",
        background: "#ffffff",
        hotspots: [],
        nodes: [
          {
            type: "navbar",
            id: "memories_navbar",
            title: "Memorias",
          },
          {
            type: "title",
            id: "memories_title",
            text: "Buscar",
            sub: "Lo que ya recordaste.",
          },
          {
            type: "input",
            id: "memory_search_input",
            bind: "searchQuery",
            placeholder: "Buscar recuerdos",
          },
          {
            type: "list",
            id: "memory_list",
            items: memories.length
              ? memories
              : [{ id: "memory_empty", title: "Sin resultados" }],
          },
        ],
      },
    ],
    demo: [],
  };
}

export const MOUN_PRODUCT_SCHEMA: ProductSchema = {
  id: "moun",
  name: "Reminders",
  description:
    "Create and manage reminders, mark them complete, and search past memories. Voice-friendly, short flows for marketing videos.",
  startScreen: "home",
  features: [
    {
      id: "reminders",
      name: "Reminders",
      description: "Create and manage reminders",
      availableActions: [
        "create_reminder",
        "edit_reminder",
        "delete_reminder",
        "complete_reminder",
      ],
    },
    {
      id: "memories",
      name: "Memories",
      description: "Search previously completed reminders",
      availableActions: ["search_memories"],
    },
  ],
  actions: [
    {
      id: "create_reminder",
      name: "Create reminder",
      description: "Open compose, type a title and time, save",
      inputs: [
        { id: "title", name: "Title", required: true, type: "text" },
        { id: "when", name: "When", required: false, type: "datetime" },
      ],
      result: "reminder_created",
      screens: ["home", "create_reminder"],
      targets: [
        "new_reminder_button",
        "reminder_input",
        "reminder_when_input",
        "save_reminder_button",
      ],
    },
    {
      id: "complete_reminder",
      name: "Complete reminder",
      description: "Open a reminder and mark it done",
      inputs: [],
      result: "reminder_completed",
      screens: ["home", "reminder_detail"],
      targets: ["reminder_item_rent", "complete_reminder_button"],
    },
    {
      id: "delete_reminder",
      name: "Delete reminder",
      description: "Open a reminder and delete it",
      inputs: [],
      result: "reminder_deleted",
      screens: ["home", "reminder_detail"],
      targets: ["reminder_item_rent", "delete_reminder_button"],
    },
    {
      id: "edit_reminder",
      name: "Edit reminder",
      description: "Change reminder title from compose",
      inputs: [
        { id: "title", name: "Title", required: true, type: "text" },
      ],
      result: "reminder_updated",
      screens: ["home", "create_reminder"],
      targets: ["new_reminder_button", "reminder_input", "save_reminder_button"],
    },
    {
      id: "search_memories",
      name: "Search memories",
      description: "Open memories and type a search query",
      inputs: [{ id: "query", name: "Query", required: true, type: "text" }],
      result: "memories_filtered",
      screens: ["memories"],
      targets: ["memories_tab", "memory_search_input"],
    },
  ],
  screens: [
    {
      id: "home",
      name: "Home",
      description: "Active reminders and create CTA",
      availableElements: [
        "home",
        "home_navbar",
        "home_count",
        "reminder_list",
        "reminder_item_rent",
        "reminder_item_call",
        "new_reminder_button",
        "home_tab",
      ],
      possibleActions: ["open", "tap", "scroll"],
      navigationTargets: ["create_reminder", "reminder_detail", "memories"],
    },
    {
      id: "create_reminder",
      name: "Create reminder",
      description: "Compose title and when, then save",
      availableElements: [
        "create_reminder",
        "create_navbar",
        "create_navbar-back",
        "reminder_input",
        "reminder_when_input",
        "save_reminder_button",
        "create_tab",
      ],
      possibleActions: ["open", "tap", "type", "submit", "back"],
      navigationTargets: ["home"],
    },
    {
      id: "reminder_detail",
      name: "Reminder detail",
      description: "Complete or delete a reminder",
      availableElements: [
        "reminder_detail",
        "detail_navbar",
        "detail_navbar-back",
        "complete_reminder_button",
        "delete_reminder_button",
      ],
      possibleActions: ["open", "tap", "back"],
      navigationTargets: ["home"],
    },
    {
      id: "memories",
      name: "Memories",
      description: "Search past reminders",
      availableElements: [
        "memories",
        "memories_navbar",
        "memory_search_input",
        "memory_list",
        "memories_tab",
      ],
      possibleActions: ["open", "tap", "type", "scroll"],
      navigationTargets: ["home"],
    },
  ],
  elements: [
    {
      id: "home",
      type: "screen",
      label: "Home",
      screen: "home",
      actions: ["open"],
      testId: "home",
    },
    {
      id: "new_reminder_button",
      type: "button",
      label: "Nuevo recordatorio",
      screen: "home",
      actions: ["tap"],
      testId: "new_reminder_button",
      bounds: { x: 0.08, y: 0.78, w: 0.84, h: 0.08 },
    },
    {
      id: "reminder_list",
      type: "list",
      label: "Lista de recordatorios",
      screen: "home",
      actions: ["tap", "scroll"],
      testId: "reminder_list",
      bounds: { x: 0.08, y: 0.32, w: 0.84, h: 0.38 },
    },
    {
      id: "reminder_item_rent",
      type: "card",
      label: "Pagar renta",
      screen: "home",
      actions: ["tap"],
      testId: "reminder_item_rent",
      bounds: { x: 0.08, y: 0.34, w: 0.84, h: 0.1 },
    },
    {
      id: "reminder_item_call",
      type: "card",
      label: "Llamar a mamá",
      screen: "home",
      actions: ["tap"],
      testId: "reminder_item_call",
      bounds: { x: 0.08, y: 0.46, w: 0.84, h: 0.1 },
    },
    {
      id: "home_tab",
      type: "tab",
      label: "Home",
      screen: "home",
      actions: ["tap", "open"],
      testId: "home_tab",
      bounds: { x: 0.05, y: 0.93, w: 0.28, h: 0.06 },
    },
    {
      id: "create_tab",
      type: "tab",
      label: "Nuevo",
      screen: "create_reminder",
      actions: ["tap", "open"],
      testId: "create_tab",
      bounds: { x: 0.36, y: 0.93, w: 0.28, h: 0.06 },
    },
    {
      id: "memories_tab",
      type: "tab",
      label: "Memorias",
      screen: "memories",
      actions: ["tap", "open"],
      testId: "memories_tab",
      bounds: { x: 0.67, y: 0.93, w: 0.28, h: 0.06 },
    },
    {
      id: "create_reminder",
      type: "screen",
      label: "Nuevo recordatorio",
      screen: "create_reminder",
      actions: ["open"],
      testId: "create_reminder",
    },
    {
      id: "create_navbar-back",
      type: "button",
      label: "Atrás",
      screen: "create_reminder",
      actions: ["tap", "back"],
      testId: "create_navbar-back",
      bounds: { x: 0.04, y: 0.04, w: 0.12, h: 0.06 },
    },
    {
      id: "reminder_input",
      type: "input",
      label: "Título del recordatorio",
      screen: "create_reminder",
      actions: ["tap", "type"],
      bind: "reminderTitle",
      testId: "reminder_input",
      bounds: { x: 0.08, y: 0.28, w: 0.84, h: 0.08 },
    },
    {
      id: "reminder_when_input",
      type: "input",
      label: "Cuándo",
      screen: "create_reminder",
      actions: ["tap", "type"],
      bind: "reminderWhen",
      testId: "reminder_when_input",
      bounds: { x: 0.08, y: 0.4, w: 0.84, h: 0.08 },
    },
    {
      id: "save_reminder_button",
      type: "button",
      label: "Guardar",
      screen: "create_reminder",
      actions: ["tap", "submit"],
      testId: "save_reminder_button",
      bounds: { x: 0.08, y: 0.54, w: 0.84, h: 0.08 },
    },
    {
      id: "reminder_detail",
      type: "screen",
      label: "Detalle",
      screen: "reminder_detail",
      actions: ["open"],
      testId: "reminder_detail",
    },
    {
      id: "detail_navbar-back",
      type: "button",
      label: "Atrás",
      screen: "reminder_detail",
      actions: ["tap", "back"],
      testId: "detail_navbar-back",
      bounds: { x: 0.04, y: 0.04, w: 0.12, h: 0.06 },
    },
    {
      id: "complete_reminder_button",
      type: "button",
      label: "Marcar hecho",
      screen: "reminder_detail",
      actions: ["tap"],
      testId: "complete_reminder_button",
      bounds: { x: 0.08, y: 0.42, w: 0.84, h: 0.08 },
    },
    {
      id: "delete_reminder_button",
      type: "button",
      label: "Eliminar",
      screen: "reminder_detail",
      actions: ["tap"],
      testId: "delete_reminder_button",
      bounds: { x: 0.08, y: 0.54, w: 0.84, h: 0.08 },
    },
    {
      id: "memories",
      type: "screen",
      label: "Memorias",
      screen: "memories",
      actions: ["open"],
      testId: "memories",
    },
    {
      id: "memory_search_input",
      type: "input",
      label: "Buscar recuerdos",
      screen: "memories",
      actions: ["tap", "type"],
      bind: "searchQuery",
      testId: "memory_search_input",
      bounds: { x: 0.08, y: 0.26, w: 0.84, h: 0.08 },
    },
    {
      id: "memory_list",
      type: "list",
      label: "Lista de memorias",
      screen: "memories",
      actions: ["tap", "scroll"],
      testId: "memory_list",
      bounds: { x: 0.08, y: 0.38, w: 0.84, h: 0.4 },
    },
  ],
};

export const mounProduct: ProductAdapter = {
  id: "moun",
  name: "Reminders",
  schema: MOUN_PRODUCT_SCHEMA,
  buildSpec() {
    return buildMounAppSpec();
  },
  hydrateSpec(spec, state) {
    const next = buildMounAppSpec(state);
    return {
      ...spec,
      screens: next.screens,
      state: { ...spec.state, ...state.values },
    };
  },
};
