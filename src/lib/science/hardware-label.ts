/** Short, human-readable hardware label from the PSI experiment_hardware + flight program strings (display only). */
export function shortenHardware(hardware: string | null | undefined, flightProgram?: string | null): string | null {
  if (!hardware) return null;
  const hw = hardware.toLowerCase();
  const fp = (flightProgram ?? "").toLowerCase();
  const where = fp.includes("international space station") || fp.includes("iss") ? "ISS" : fp.includes("cygnus") ? "Cygnus" : fp.includes("not applicable") ? "Ground" : "";
  let name: string;
  if (hw.includes("cygnus") || hw.includes("saffire")) name = "Saffire (Cygnus)";
  else if (hw.includes("cir") && hw.includes("mdca")) name = "CIR (MDCA)";
  else if (hw.includes("cir") && hw.includes("acme")) name = "CIR (ACME)";
  else if (hw.includes("counterflow")) name = "Counterflow burner";
  else if (hw.includes("same") && hw.includes("msg")) name = "MSG (SAME)";
  else if (hw.includes("spice")) name = "MSG (SPICE)";
  else if (hw.includes("glovebox") || hw.includes("msg")) name = "MSG";
  else if (hw.includes("soot diagnostic")) name = "Soot diagnostics";
  else if (hw.includes("p-trak")) name = "TSI P-Trak";
  else if (hw.includes("cir")) name = "CIR";
  else name = hardware.length > 28 ? `${hardware.slice(0, 26)}…` : hardware;
  return where && !name.includes("Cygnus") ? `${where} · ${name}` : name;
}

/** "Ethylene, Methane, Propane (+4)" for long comma-joined fuel lists. */
export function shortFuels(text: string, n = 3): string {
  const parts = text.split(/,\s*/).filter(Boolean);
  return parts.length > n ? `${parts.slice(0, n).join(", ")} (+${parts.length - n})` : parts.join(", ");
}

export function forcedFlowLabel(range: [number, number] | null | undefined): string | null {
  if (!range || !(range[1] > 0)) return null;
  const f = (v: number) => Number(v.toFixed(1)).toString();
  return `Forced-flow runs: ${f(range[0])}–${f(range[1])} cm/s`;
}
