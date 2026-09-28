"use client";

import { Img } from "remotion";
import type {
  AppAction,
  AppCursor,
  AppDemoSpec,
  AppRuntimeState,
  AppScreenSpec,
  UiNode,
} from "@/lib/creator/app-demo";
import { screenById } from "@/lib/creator/app-demo";

const FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

function displayValue(
  state: AppRuntimeState,
  bind: string | undefined,
  fallback: string
) {
  if (!bind) return fallback;
  const v = state.values[bind];
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function NodeView({
  node,
  spec,
  state,
  interactive,
  onAction,
}: {
  node: UiNode;
  spec: AppDemoSpec;
  state: AppRuntimeState;
  interactive: boolean;
  onAction?: (action: AppAction | undefined, id: string) => void;
}) {
  const accent = spec.accent;
  if (node.type === "spacer") {
    return <div style={{ height: 10 }} />;
  }
  if (node.type === "navbar") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 4px 14px",
        }}
      >
        {node.back ? (
          <button
            type="button"
            data-testid={`${node.id}-back`}
            onClick={() => interactive && onAction?.(node.back, `${node.id}-back`)}
            style={{
              border: "none",
              background: "transparent",
              color: accent,
              fontSize: 22,
              fontFamily: FONT,
              cursor: interactive ? "pointer" : "default",
            }}
          >
            ‹
          </button>
        ) : (
          <div style={{ width: 18 }} />
        )}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 700,
            fontSize: 16,
            fontFamily: FONT,
            color: "#111827",
          }}
        >
          {node.title}
        </div>
        <div style={{ width: 18 }} />
      </div>
    );
  }
  if (node.type === "title") {
    return (
      <div style={{ padding: "4px 4px 10px" }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            fontFamily: FONT,
            color: "#111827",
            letterSpacing: -0.4,
          }}
        >
          {node.text}
        </div>
        {node.sub ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#6b7280",
              fontFamily: FONT,
            }}
          >
            {node.sub}
          </div>
        ) : null}
      </div>
    );
  }
  if (node.type === "text") {
    return (
      <div
        style={{
          padding: "2px 4px 8px",
          fontSize: 13,
          lineHeight: 1.45,
          color: "#4b5563",
          fontFamily: FONT,
        }}
      >
        {node.text}
      </div>
    );
  }
  if (node.type === "chip") {
    return (
      <div style={{ padding: "0 4px 8px" }}>
        <span
          style={{
            display: "inline-block",
            borderRadius: 999,
            backgroundColor: `${accent}22`,
            color: accent,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: FONT,
            padding: "4px 10px",
          }}
        >
          {node.text}
        </span>
      </div>
    );
  }
  if (node.type === "stat") {
    return (
      <div
        style={{
          margin: "4px 4px 10px",
          padding: "12px 14px",
          borderRadius: 16,
          backgroundColor: "#f3f4f6",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            fontFamily: FONT,
            fontWeight: 600,
          }}
        >
          {node.label}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 22,
            fontWeight: 800,
            fontFamily: FONT,
            color: "#111827",
          }}
        >
          {displayValue(state, node.bind, node.value)}
        </div>
      </div>
    );
  }
  if (node.type === "button") {
    const bg =
      node.variant === "primary"
        ? accent
        : node.variant === "secondary"
          ? "#111827"
          : "transparent";
    const color = node.variant === "ghost" ? accent : "#fff";
    const border =
      node.variant === "ghost" ? `1px solid ${accent}` : "none";
    return (
      <button
        type="button"
        data-testid={node.id}
        onClick={() => interactive && onAction?.(node.action, node.id)}
        style={{
          width: "100%",
          margin: "4px 0 8px",
          border,
          borderRadius: 14,
          backgroundColor: bg,
          color,
          fontSize: 15,
          fontWeight: 700,
          fontFamily: FONT,
          padding: "12px 14px",
          cursor: interactive ? "pointer" : "default",
        }}
      >
        {node.label}
      </button>
    );
  }
  if (node.type === "input") {
    const value = displayValue(state, node.bind, "");
    return (
      <input
        data-testid={node.id}
        value={value}
        placeholder={node.placeholder}
        readOnly={!interactive}
        onChange={(e) =>
          interactive &&
          onAction?.(
            { type: "set", key: node.bind, value: e.target.value },
            node.id
          )
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
          margin: "4px 0 8px",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "12px 12px",
          fontSize: 14,
          fontFamily: FONT,
          color: "#111827",
          backgroundColor: "#fff",
        }}
      />
    );
  }
  if (node.type === "toggle") {
    const on = Boolean(state.values[node.bind]);
    return (
      <button
        type="button"
        data-testid={node.id}
        onClick={() =>
          interactive &&
          onAction?.({ type: "toggle", key: node.bind }, node.id)
        }
        style={{
          width: "100%",
          margin: "4px 0 8px",
          border: "none",
          background: "#f3f4f6",
          borderRadius: 14,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: interactive ? "pointer" : "default",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT,
            color: "#111827",
          }}
        >
          {node.label}
        </span>
        <span
          style={{
            width: 42,
            height: 24,
            borderRadius: 99,
            backgroundColor: on ? accent : "#d1d5db",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: on ? 20 : 2,
              width: 20,
              height: 20,
              borderRadius: 99,
              backgroundColor: "#fff",
            }}
          />
        </span>
      </button>
    );
  }
  if (node.type === "tabs") {
    const current = String(state.values[node.bind] || node.items[0]?.id || "");
    return (
      <div
        style={{
          display: "flex",
          gap: 6,
          margin: "4px 0 10px",
          padding: 4,
          borderRadius: 14,
          backgroundColor: "#f3f4f6",
        }}
      >
        {node.items.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={item.id}
              onClick={() =>
                interactive &&
                onAction?.(
                  { type: "set", key: node.bind, value: item.id },
                  item.id
                )
              }
              style={{
                flex: 1,
                border: "none",
                borderRadius: 10,
                padding: "8px 4px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: FONT,
                backgroundColor: active ? "#fff" : "transparent",
                color: active ? "#111827" : "#6b7280",
                cursor: interactive ? "pointer" : "default",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (node.type === "list" || node.type === "cards") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {node.items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={item.id}
              onClick={() => interactive && onAction?.(item.action, item.id)}
            style={{
              textAlign: "left",
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: node.type === "cards" ? 18 : 14,
              padding: node.type === "cards" ? "14px 14px" : "12px 12px",
              cursor: interactive ? "pointer" : "default",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: FONT,
                  color: "#111827",
                }}
              >
                {item.title}
              </div>
              {"meta" in item && item.meta ? (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: FONT,
                    color: accent,
                  }}
                >
                  {item.meta}
                </div>
              ) : null}
            </div>
            {item.sub ? (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: "#6b7280",
                  fontFamily: FONT,
                }}
              >
                {item.sub}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    );
  }
  return null;
}

function ScreensView({
  screen,
  playback,
  interactive,
  onAction,
}: {
  screen: AppScreenSpec;
  playback: boolean;
  interactive: boolean;
  onAction?: (action: AppAction | undefined, id: string) => void;
}) {
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#000" }}>
      {screen.imageUrl ? (
        playback ? (
          <Img
            src={screen.imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <img
            src={screen.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )
      ) : (
        <div style={{ width: "100%", height: "100%", background: "#111" }} />
      )}
      {screen.hotspots.map((hot) => (
        <button
          key={hot.id}
          type="button"
          data-testid={hot.id}
          aria-label={hot.label}
          onClick={() => interactive && onAction?.(hot.action, hot.id)}
          style={{
            position: "absolute",
            left: `${hot.x}%`,
            top: `${hot.y}%`,
            width: `${hot.w}%`,
            height: `${hot.h}%`,
            border: interactive ? "1.5px solid rgba(255,255,255,0.55)" : "none",
            borderRadius: 12,
            background: interactive ? "rgba(255,255,255,0.08)" : "transparent",
            cursor: interactive ? "pointer" : "default",
          }}
        />
      ))}
    </div>
  );
}

function FunctionalView({
  spec,
  screen,
  state,
  interactive,
  onAction,
}: {
  spec: AppDemoSpec;
  screen: AppScreenSpec;
  state: AppRuntimeState;
  interactive: boolean;
  onAction?: (action: AppAction | undefined, id: string) => void;
}) {
  return (
    <div
      data-testid={screen.id}
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: screen.background || "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          padding: "8px 14px 10px",
        }}
      >
        {screen.nodes.map((node) => (
          <NodeView
            key={node.id}
            node={node}
            spec={spec}
            state={state}
            interactive={interactive}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

export function AppMiniApp({
  spec,
  state,
  cursor,
  playback = false,
  interactive = false,
  onAction,
}: {
  spec: AppDemoSpec;
  state: AppRuntimeState;
  cursor?: AppCursor | null;
  playback?: boolean;
  interactive?: boolean;
  onAction?: (action: AppAction | undefined, id: string) => void;
}) {
  const screen = screenById(spec, state.screen);
  if (!screen) return null;
  const functional = spec.kind === "functional" && screen.nodes.length > 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      {functional ? (
        <FunctionalView
          spec={spec}
          screen={screen}
          state={state}
          interactive={interactive}
          onAction={onAction}
        />
      ) : (
        <ScreensView
          screen={screen}
          playback={playback}
          interactive={interactive}
          onAction={onAction}
        />
      )}

      {spec.tabs.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 58,
            borderTop: "1px solid #e5e7eb",
            backgroundColor: "#fff",
            display: "flex",
          }}
        >
          {spec.tabs.map((tab) => {
            const active = tab.screen === state.screen;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={tab.id}
                onClick={() =>
                  interactive &&
                  onAction?.(
                    { type: "navigate", screen: tab.screen },
                    tab.id
                  )
                }
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  color: active ? spec.accent : "#9ca3af",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: FONT,
                  cursor: interactive ? "pointer" : "default",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {cursor?.visible ? (
        <div
          style={{
            position: "absolute",
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            width: cursor.pressed ? 42 : 34,
            height: cursor.pressed ? 42 : 34,
            marginLeft: cursor.pressed ? -21 : -17,
            marginTop: cursor.pressed ? -21 : -17,
            borderRadius: 99,
            border: "3px solid rgba(255,255,255,0.95)",
            backgroundColor: cursor.pressed
              ? "rgba(255,255,255,0.45)"
              : "rgba(255,255,255,0.2)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
