"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AssistantCitation } from "@/lib/assistant/assistant-response-schema";

const pill =
  "mx-0.5 inline-flex items-center rounded-md border px-1.5 py-px align-baseline font-mono text-[10.5px] font-bold transition-colors";

/** Inline formatting: **bold**, `code`, [n] citation pills (open the evidence drawer) and PSI-nnn investigation pills (link to the record). */
function inline(text: string, citations: AssistantCitation[], onCite: (c: AssistantCitation) => void, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\]|(?<![\w-])PSI-\d+(?![\w-]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-bold text-white">{inline(tok.slice(2, -2).replace(/\*/g, ""), citations, onCite, `${k}b`)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-white/10 px-1 py-px font-mono text-[0.92em] text-[#ffb067]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const num = Number(tok.slice(1, -1));
      const cit = citations.find((c) => c.citationNumber === num);
      out.push(
        cit ? (
          <button key={k} type="button" onClick={() => onCite(cit)} data-testid={`citation-chip-${num}`} title={`${cit.investigationId} · ${cit.fieldLabel}`} className={`${pill} border-[#36a9ff]/45 bg-[#36a9ff]/15 text-[#7bc5ff] hover:bg-[#36a9ff]/30`}>
            {tok}
          </button>
        ) : (
          tok
        ),
      );
    } else {
      out.push(
        <Link key={k} href={`/investigations/${encodeURIComponent(tok)}`} className={`${pill} border-[#ff8a32]/40 bg-[#ff5500]/10 text-[#ffb067] hover:bg-[#ff5500]/25`}>
          {tok}
        </Link>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Item = { text: string; children: Item[] };
type ListBlock = { ordered: boolean; items: Item[] };

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Safe Markdown renderer (headings, paragraphs, nested bullet / numbered lists, GFM tables, rules, **bold**, `code`) with clickable PSI citation pills. No HTML is ever injected. */
export function MarkdownAnswer({ text, citations, onCite }: { text: string; citations: AssistantCitation[]; onCite: (c: AssistantCitation) => void }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: ListBlock | null = null;
  let para: string[] = [];
  let n = 0;
  const flushPara = () => {
    if (para.length) {
      const k = `p${n++}`;
      blocks.push(<p key={k} className="max-w-[75ch] text-sm leading-[1.7] text-[#f4f8ff]">{inline(para.join(" "), citations, onCite, k)}</p>);
      para = [];
    }
  };
  const renderItems = (items: Item[], ordered: boolean, k: string, depth: number): ReactNode => {
    const Tag = ordered ? "ol" : "ul";
    return (
      <Tag key={k} className={`${depth ? "mt-1" : ""} space-y-1.5 pl-5 text-sm leading-[1.65] text-[#e5efff] marker:text-[#52b6ff]/70 ${ordered ? "list-decimal" : depth ? "list-[circle]" : "list-disc"}`}>
        {items.map((it, j) => (
          <li key={j} className="max-w-[80ch] pl-0.5">
            {inline(it.text, citations, onCite, `${k}-${j}`)}
            {it.children.length > 0 && renderItems(it.children, false, `${k}-${j}c`, depth + 1)}
          </li>
        ))}
      </Tag>
    );
  };
  const flushList = () => {
    if (list) {
      blocks.push(renderItems(list.items, list.ordered, `l${n++}`, 0));
      list = null;
    }
  };
  const isRule = (l: string) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l);
  const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-") && l.includes("|");
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const ol = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (isRule(line)) {
      flushPara(); flushList();
      blocks.push(<hr key={`hr${n++}`} className="my-1 border-white/10" />);
    } else if (h) {
      flushPara(); flushList();
      const k = `h${n++}`;
      const lvl = h[1].length;
      const cls = lvl === 1
        ? "mt-2 text-lg font-extrabold text-white"
        : lvl === 2
          ? "mt-3 border-b border-white/10 pb-1 text-[15px] font-extrabold tracking-tight text-white first:mt-0"
          : "mt-2 text-sm font-bold text-[#7bc5ff]";
      blocks.push(lvl === 2 ? <h2 key={k} className={cls}>{inline(h[2], citations, onCite, k)}</h2> : <h3 key={k} className={cls}>{inline(h[2], citations, onCite, k)}</h3>);
    } else if (line.includes("|") && idx + 1 < lines.length && isTableSep(lines[idx + 1]) && !isTableSep(line)) {
      flushPara(); flushList();
      const head = splitRow(line);
      const rows: string[][] = [];
      let j = idx + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") { rows.push(splitRow(lines[j])); j++; }
      idx = j - 1;
      const k = `t${n++}`;
      blocks.push(
        <div key={k} className="max-w-full overflow-x-auto rounded-lg border border-white/10" data-testid="assistant-table">
          <table className="w-full border-collapse text-left text-[13px] leading-snug">
            <thead className="bg-white/[0.06] text-[11px] font-bold tracking-wide text-[#9fc4ee] uppercase">
              <tr>{head.map((c, ci) => <th key={ci} className="px-3 py-2 align-bottom">{inline(c, citations, onCite, `${k}h${ci}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07] text-[#e5efff]">
              {rows.map((r, ri) => (
                <tr key={ri} className="odd:bg-white/[0.02]">
                  {head.map((_, ci) => <td key={ci} className="px-3 py-1.5 align-top">{inline(r[ci] ?? "", citations, onCite, `${k}r${ri}c${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (ul || ol) {
      flushPara();
      const m = (ul ?? ol)!;
      const hasList = (list as ListBlock | null) !== null;
      const depth: number = m[1].replace(/\t/g, "  ").length >= 2 && hasList ? 1 : 0;
      const ordered: boolean = !!ol && depth === 0;
      if (depth === 0 && (!list || list.ordered !== ordered)) { flushList(); list = { ordered, items: [] }; }
      const cur = list as ListBlock | null;
      if (cur) {
        if (depth === 1 && cur.items.length) cur.items[cur.items.length - 1].children.push({ text: m[2], children: [] });
        else cur.items.push({ text: m[2], children: [] });
      }
    } else if (line.trim() === "") {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return <div className="space-y-3" data-testid="assistant-markdown">{blocks}</div>;
}
