import type { AppDemoSpec } from "@/lib/creator/app-demo";
import { schemaFromAppDemoSpec } from "./schema-from-spec";
import { mounProduct } from "./products/moun";
import type { ProductAdapter } from "./types";

export type { ProductAdapter } from "./types";

const registry = new Map<string, ProductAdapter>();

export function registerProduct(adapter: ProductAdapter) {
  registry.set(adapter.id, adapter);
}

export function getProduct(id: string): ProductAdapter | null {
  return registry.get(id) || null;
}

export function listProducts(): ProductAdapter[] {
  return [...registry.values()];
}

export function adapterFromAppDemoSpec(
  spec: AppDemoSpec,
  id = "from-app-demo"
): ProductAdapter {
  const schema = schemaFromAppDemoSpec(spec, {
    id,
    description: spec.summary || spec.tagline,
  });
  return {
    id,
    name: spec.appName || "App Demo",
    schema,
    buildSpec() {
      return spec;
    },
  };
}

export function resolveProduct(opts: {
  productId?: string;
  appSpec?: AppDemoSpec | null;
}): ProductAdapter {
  const id = (opts.productId || "").trim();
  if (id && id !== "from-app-demo") {
    const found = getProduct(id);
    if (found) return found;
  }
  if (opts.appSpec && opts.appSpec.screens.length > 0) {
    return adapterFromAppDemoSpec(opts.appSpec);
  }
  return mounProduct;
}

registerProduct(mounProduct);
