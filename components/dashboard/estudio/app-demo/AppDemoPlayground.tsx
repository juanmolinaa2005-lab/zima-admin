"use client";

import { useEffect, useState } from "react";
import {
  applyAction,
  initialRuntime,
  type AppDemoSpec,
} from "@/lib/creator/app-demo";
import { AppMiniApp } from "./AppMiniApp";

export function AppDemoPlayground({ spec }: { spec: AppDemoSpec }) {
  const [state, setState] = useState(() => initialRuntime(spec));

  useEffect(() => {
    setState(initialRuntime(spec));
  }, [spec]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl bg-black">
        <div className="absolute inset-[7px] overflow-hidden rounded-xl bg-white">
          <AppMiniApp
            spec={spec}
            state={state}
            interactive
            onAction={(action) =>
              setState((prev) => applyAction(spec, prev, action))
            }
          />
        </div>
      </div>
      <button
        type="button"
        className="mt-2 text-[12px] text-white/50 hover:text-white/80"
        onClick={() => setState(initialRuntime(spec))}
      >
        Reiniciar mini-app
      </button>
    </div>
  );
}
