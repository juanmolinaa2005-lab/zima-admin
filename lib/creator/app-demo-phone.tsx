import type { ComponentType } from "react";
import { AbsoluteFill } from "remotion";
import { APP_DEMO_HEIGHT, APP_DEMO_WIDTH } from "@/lib/creator/app-demo";

const PHONE_H = 1820;
const PHONE_W = Math.round((PHONE_H * 393) / 852);
const BEZEL = 14;
const RADIUS = Math.round(PHONE_W * 0.14);
const SCREEN_W = PHONE_W - BEZEL * 2;
const SCREEN_H = PHONE_H - BEZEL * 2;
const SCREEN_RADIUS = RADIUS - 12;
const SAFE_TOP = 84;
const PHONE_LEFT = (APP_DEMO_WIDTH - PHONE_W) / 2;
const PHONE_TOP = (APP_DEMO_HEIGHT - PHONE_H) / 2;

export function wrapAppDemoPhoneFrame(
  Inner: ComponentType<Record<string, unknown>>,
  innerWidth: number,
  _innerHeight: number
): ComponentType<Record<string, unknown>> {
  const width = Math.max(1, innerWidth);
  const fitW = SCREEN_W;
  const fitH = SCREEN_H - SAFE_TOP;
  const scale = fitW / width;
  const contentH = Math.round(width * (fitH / fitW));

  function PhoneFramed(props: Record<string, unknown>) {
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent" }}>
        <div
          style={{
            position: "absolute",
            left: PHONE_LEFT - 6,
            top: PHONE_TOP + PHONE_H * 0.138,
            width: 6,
            height: 72,
            borderRadius: 3,
            backgroundColor: "#2f3035",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: PHONE_LEFT - 6,
            top: PHONE_TOP + PHONE_H * 0.191,
            width: 6,
            height: 120,
            borderRadius: 3,
            backgroundColor: "#2f3035",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: PHONE_LEFT - 6,
            top: PHONE_TOP + PHONE_H * 0.272,
            width: 6,
            height: 120,
            borderRadius: 3,
            backgroundColor: "#2f3035",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: PHONE_LEFT + PHONE_W,
            top: PHONE_TOP + PHONE_H * 0.204,
            width: 6,
            height: 150,
            borderRadius: 3,
            backgroundColor: "#2f3035",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: PHONE_LEFT,
            top: PHONE_TOP,
            width: PHONE_W,
            height: PHONE_H,
            borderRadius: RADIUS,
            background:
              "linear-gradient(160deg, #3a3b40 0%, #1a1b1f 38%, #0e0e10 100%)",
            boxShadow:
              "0 50px 110px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: BEZEL,
              top: BEZEL,
              width: SCREEN_W,
              height: SCREEN_H,
              borderRadius: SCREEN_RADIUS,
              backgroundColor: "#000",
              overflow: "hidden",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: SAFE_TOP,
                width,
                height: contentH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <Inner {...props} />
            </div>

            <div
              style={{
                position: "absolute",
                top: 22,
                left: (SCREEN_W - 168) / 2,
                width: 168,
                height: 48,
                borderRadius: 28,
                backgroundColor: "#000",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                zIndex: 3,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 14,
                  width: 24,
                  height: 24,
                  borderRadius: 99,
                  background:
                    "radial-gradient(circle at 35% 30%, #3b4a66 0%, #111827 55%, #050505 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 50,
                  width: 14,
                  height: 14,
                  borderRadius: 99,
                  backgroundColor: "#0b0b0d",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
                }}
              />
            </div>

            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: (SCREEN_W - 168) / 2,
                width: 168,
                height: 6,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.34)",
                zIndex: 3,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  PhoneFramed.displayName = "AppDemoPhoneFrame";
  return PhoneFramed;
}
