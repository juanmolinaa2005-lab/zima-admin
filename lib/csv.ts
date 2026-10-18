export function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Picks whichever of comma, semicolon or tab splits the header line into the most columns. */
export function detectCsvSeparator(headerLine: string) {
  return [",", ";", "\t"].sort((a, b) => headerLine.split(b).length - headerLine.split(a).length)[0];
}
