import { InternalStateExecutor } from "./controller";
import type { ProductAdapter } from "./types";
import type { ControllerSnapshot } from "./controller";
import type { DemoSpec } from "./types";

export async function playDemoSpec(
  adapter: ProductAdapter,
  demo: DemoSpec,
  onTick: (snap: ControllerSnapshot, stepIndex: number, status: "run" | "done") => void,
  signal: AbortSignal
) {
  const executor = new InternalStateExecutor(adapter);
  onTick(executor.snapshot(), -1, "run");

  for (let i = 0; i < demo.steps.length; i += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const step = demo.steps[i];
    executor.applyStep(step);
    onTick(executor.snapshot(), i, "run");
    const wait = Math.max(80, step.duration + step.delayAfter);
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, wait);
      const onAbort = () => {
        window.clearTimeout(t);
        signal.removeEventListener("abort", onAbort);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }

  onTick(executor.snapshot(), demo.steps.length, "done");
}
