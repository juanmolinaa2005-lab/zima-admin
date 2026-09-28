import { DocsShell } from "@/components/docs/DocsShell";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return <DocsShell>{children}</DocsShell>;
}
