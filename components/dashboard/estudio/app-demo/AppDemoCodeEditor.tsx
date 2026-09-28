"use client";

import Editor, { type OnMount } from "@monaco-editor/react";

export function AppDemoCodeEditor({
  value,
  onChange,
  tone = "dark",
  path = "AppDemo.tsx",
}: {
  value: string;
  onChange: (next: string) => void;
  tone?: "light" | "dark";
  path?: string;
}) {
  const handleMount: OnMount = (_editor, monaco) => {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.React,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
    });
  };

  return (
    <Editor
      defaultPath={path}
      language="typescript"
      theme={tone === "dark" ? "vs-dark" : "light"}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      onMount={handleMount}
      loading={
        <div
          className={`flex h-full items-center justify-center text-[13px] ${
            tone === "dark" ? "text-white/40" : "text-[#9ca3af]"
          }`}
        >
          Cargando editor…
        </div>
      }
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 22,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
        renderLineHighlight: "gutter",
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
