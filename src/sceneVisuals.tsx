import type { ReactNode } from "react";

export type VisualId =
  | "hub" | "flow" | "checklist" | "compare" | "cycle" | "layers" | "timeline" | "bars"
  | "venn" | "tree" | "idea" | "target" | "blocks" | "qa" | "spotlight";

type Props = { words: string[]; title: string };

const w = (words: string[], i: number, max = 10) => (words[i % words.length] ?? "").slice(0, max);
const delay = (i: number, step = 0.4) => ({ animationDelay: `${i * step}s` });

const VISUALS: Record<VisualId, (props: Props) => ReactNode> = {
  hub: ({ words, title }) => (
    <>
      {words.slice(0, 5).map((word, i, list) => {
        const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        const x = 160 + Math.cos(angle) * 112;
        const y = 110 + Math.sin(angle) * 78;
        return (
          <g key={word} className="sv-float" style={delay(i, 0.3)}>
            <line x1="160" y1="110" x2={x} y2={y} className="sv-line" style={delay(i, 0.2)} />
            <rect x={x - 40} y={y - 14} width="80" height="28" rx="14" className="sv-pill" />
            <text x={x} y={y + 4} textAnchor="middle" className="sv-small">{word.slice(0, 11)}</text>
          </g>
        );
      })}
      <circle cx="160" cy="110" r="38" className="sv-core" />
      <text x="160" y="115" textAnchor="middle" className="sv-title">{title.slice(0, 12)}</text>
    </>
  ),
  flow: ({ words }) => {
    const items = words.slice(0, 4);
    const width = 320 / items.length;
    return (
      <>
        {items.map((word, i) => {
          const cx = width * i + width / 2;
          return (
            <g key={word}>
              {i < items.length - 1 && <path d={`M${cx + 30} 110 L${cx + width - 30} 110`} className="sv-arrow" style={delay(i + 0.5, 0.6)} />}
              <circle cx={cx} cy="110" r="29" className="sv-node" style={delay(i, 0.6)} />
              <text x={cx} y="114" textAnchor="middle" className="sv-small">{word.slice(0, 8)}</text>
              <text x={cx} y="168" textAnchor="middle" className="sv-step">Step {i + 1}</text>
            </g>
          );
        })}
      </>
    );
  },
  checklist: ({ words }) => (
    <>
      <text x="30" y="150" className="sv-big">✓</text>
      {words.slice(0, 3).map((word, i) => (
        <g key={word} transform={`translate(110 ${46 + i * 54})`}>
          <rect width="196" height="38" rx="10" className="sv-pill" />
          <path d="M12 20 l7 7 l13 -15" className="sv-tick" style={delay(i, 0.7)} />
          <text x="46" y="24" className="sv-small sv-left">{word.slice(0, 16)}</text>
        </g>
      ))}
    </>
  ),
  compare: ({ words }) => (
    <>
      {[0, 1].map((side) => (
        <g key={side} transform={`translate(${20 + side * 150} 24)`}>
          <rect width="130" height="172" rx="14" className="sv-pill" />
          <text x="65" y="32" textAnchor="middle" className="sv-title">{w(words, side)}</text>
          {[0, 1, 2].map((row) => (
            <g key={row} className="sv-pop" style={delay(row + side * 3, 0.25)}>
              <rect x="14" y={54 + row * 36} width="102" height="24" rx="8" className="sv-bar-bg" />
              <text x="65" y={70 + row * 36} textAnchor="middle" className="sv-small">{w(words, side * 3 + row + 2, 9)}</text>
            </g>
          ))}
        </g>
      ))}
      <text x="160" y="116" textAnchor="middle" className="sv-vs">vs</text>
    </>
  ),
  cycle: ({ words }) => (
    <>
      <circle cx="160" cy="110" r="68" className="sv-ring" />
      {words.slice(0, 4).map((word, i, list) => {
        const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        const x = 160 + Math.cos(angle) * 68;
        const y = 110 + Math.sin(angle) * 68;
        return (
          <g key={word}>
            <circle cx={x} cy={y} r="24" className="sv-node" style={delay(i, 0.5)} />
            <text x={x} y={y + 4} textAnchor="middle" className="sv-small">{word.slice(0, 7)}</text>
          </g>
        );
      })}
      <text x="160" y="115" textAnchor="middle" className="sv-step">repeat</text>
    </>
  ),
  layers: ({ words }) => (
    <>
      {[0, 1, 2, 3].map((i) => {
        const width = 90 + i * 55;
        return (
          <g key={i} className="sv-pop" style={delay(3 - i, 0.35)}>
            <rect x={160 - width / 2} y={26 + i * 46} width={width} height="38" rx="9" className="sv-pill" />
            <text x="160" y={50 + i * 46} textAnchor="middle" className="sv-small">{w(words, i, 12)}</text>
          </g>
        );
      })}
    </>
  ),
  timeline: ({ words }) => (
    <>
      <line x1="24" y1="110" x2="296" y2="110" className="sv-arrow" />
      {words.slice(0, 4).map((word, i, list) => {
        const x = 50 + (i * 220) / Math.max(list.length - 1, 1);
        return (
          <g key={word} className="sv-pop" style={delay(i, 0.45)}>
            <circle cx={x} cy="110" r="9" className="sv-dot" />
            <text x={x} y={i % 2 ? 150 : 78} textAnchor="middle" className="sv-small">{word.slice(0, 9)}</text>
          </g>
        );
      })}
    </>
  ),
  bars: ({ words }) => (
    <>
      <line x1="30" y1="190" x2="300" y2="190" className="sv-line-static" />
      {words.slice(0, 5).map((word, i) => {
        const height = 50 + ((i * 37) % 90);
        return (
          <g key={word}>
            <rect x={44 + i * 52} y={190 - height} width="36" height={height} rx="6" className="sv-bar" style={delay(i, 0.2)} />
            <text x={62 + i * 52} y="208" textAnchor="middle" className="sv-step">{word.slice(0, 6)}</text>
          </g>
        );
      })}
    </>
  ),
  venn: ({ words }) => (
    <>
      <circle cx="125" cy="110" r="64" className="sv-venn" />
      <circle cx="195" cy="110" r="64" className="sv-venn" />
      <text x="90" y="114" textAnchor="middle" className="sv-small">{w(words, 0, 8)}</text>
      <text x="230" y="114" textAnchor="middle" className="sv-small">{w(words, 1, 8)}</text>
      <text x="160" y="114" textAnchor="middle" className="sv-title">{w(words, 2, 7)}</text>
    </>
  ),
  tree: ({ words }) => (
    <>
      <rect x="110" y="16" width="100" height="32" rx="10" className="sv-core" />
      <text x="160" y="37" textAnchor="middle" className="sv-small">{w(words, 0, 12)}</text>
      {[0, 1, 2].map((i) => {
        const x = 55 + i * 105;
        return (
          <g key={i}>
            <path d={`M160 48 L${x} 100`} className="sv-line" style={delay(i, 0.3)} />
            <rect x={x - 42} y="100" width="84" height="30" rx="10" className="sv-pill sv-pop" style={delay(i + 1, 0.3)} />
            <text x={x} y="120" textAnchor="middle" className="sv-small">{w(words, i + 1, 10)}</text>
            <path d={`M${x} 130 L${x} 166`} className="sv-line" style={delay(i + 2, 0.3)} />
            <rect x={x - 36} y="166" width="72" height="28" rx="9" className="sv-bar-bg sv-pop" style={delay(i + 3, 0.3)} />
            <text x={x} y="184" textAnchor="middle" className="sv-step">{w(words, i + 4, 9)}</text>
          </g>
        );
      })}
    </>
  ),
  idea: ({ words }) => (
    <>
      <circle cx="160" cy="88" r="52" className="sv-core" />
      <rect x="140" y="140" width="40" height="22" rx="6" className="sv-pill" />
      <rect x="146" y="166" width="28" height="10" rx="5" className="sv-pill" />
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = -Math.PI + (i / 4) * Math.PI;
        return <line key={i} x1={160 + Math.cos(angle) * 62} y1={88 + Math.sin(angle) * 62} x2={160 + Math.cos(angle) * 82} y2={88 + Math.sin(angle) * 82} className="sv-ray" style={delay(i, 0.15)} />;
      })}
      <text x="160" y="93" textAnchor="middle" className="sv-title">{w(words, 0, 10)}</text>
    </>
  ),
  target: ({ words }) => (
    <>
      <circle cx="160" cy="110" r="84" className="sv-ring" />
      <circle cx="160" cy="110" r="56" className="sv-ring" />
      <circle cx="160" cy="110" r="28" className="sv-core" />
      <path d="M160 110 L252 40" className="sv-arrow" />
      <text x="160" y="114" textAnchor="middle" className="sv-small">{w(words, 0, 8)}</text>
    </>
  ),
  blocks: ({ words }) => (
    <>
      {[[0, 2], [1, 2], [2, 2], [0, 1], [1, 1], [0, 0]].slice(0, Math.min(6, words.length + 2)).map(([col, row], i) => (
        <g key={i} className="sv-pop" style={delay(i, 0.3)}>
          <rect x={60 + col * 66} y={140 - row * 50} width="62" height="46" rx="8" className="sv-pill" />
          <text x={91 + col * 66} y={168 - row * 50} textAnchor="middle" className="sv-small">{w(words, i, 7)}</text>
        </g>
      ))}
    </>
  ),
  qa: ({ words }) => (
    <>
      <g className="sv-pop">
        <rect x="24" y="30" width="190" height="56" rx="16" className="sv-pill" />
        <text x="119" y="64" textAnchor="middle" className="sv-small">What is {w(words, 0, 9)}?</text>
      </g>
      <g className="sv-pop" style={delay(2, 0.5)}>
        <rect x="106" y="110" width="190" height="56" rx="16" className="sv-core" />
        <text x="201" y="144" textAnchor="middle" className="sv-small">{w(words, 1, 9)} ✓</text>
      </g>
    </>
  ),
  spotlight: ({ words }) => (
    <>
      <circle cx="140" cy="100" r="58" className="sv-ring" />
      <line x1="182" y1="142" x2="250" y2="200" className="sv-arrow" />
      <text x="140" y="105" textAnchor="middle" className="sv-title">{w(words, 0, 10)}</text>
      {words.slice(1, 4).map((word, i) => (
        <text key={word} x="262" y={40 + i * 24} className="sv-step sv-left sv-pop" style={delay(i, 0.4)}>• {word.slice(0, 9)}</text>
      ))}
    </>
  ),
};

const CUES: Array<[VisualId, RegExp]> = [
  ["compare", /\b(versus|vs\.?|differ\w*|compar\w*|whereas|unlike|contrast)\b/i],
  ["cycle", /\b(loop\w*|repeat\w*|cycle\w*|iterat\w*|recurs\w*)\b/i],
  ["layers", /\b(layer\w*|level\w*|stack\w*|tier\w*)\b/i],
  ["timeline", /\b(histor\w*|timeline|before|after|eventual\w*|sequence)\b/i],
  ["bars", /\b(percent\w*|score\w*|data|average|measure\w*|statistic\w*|\d+%)/i],
  ["venn", /\b(both|overlap\w*|common|shared|similar\w*)\b/i],
  ["tree", /\b(types?|kinds?|categor\w*|hierarch\w*|parent|child|branch\w*|class\w*)\b/i],
  ["target", /\b(goals?|aims?|target\w*|objective\w*|outcome\w*)\b/i],
  ["blocks", /\b(build\w*|parts?|components?|blocks?|combine\w*|structure\w*)\b/i],
  ["flow", /\b(steps?|then|first|process\w*|procedure\w*|follow\w*|workflow\w*)\b/i],
  ["idea", /\b(idea|insight|concept|principle|why|key)\b/i],
  ["qa", /\b(questions?|ask\w*|answer\w*|quiz\w*|practi[cs]e|try)\b/i],
  ["spotlight", /\b(example|identify|spot|notice|look\w*|find)\b/i],
];

export function pickVisual(text: string, used: VisualId[], fallbacks: VisualId[]): VisualId {
  const match = CUES.find(([id, pattern]) => pattern.test(text) && !used.includes(id));
  if (match) return match[0];
  return fallbacks.find((id) => !used.includes(id)) ?? fallbacks[0];
}

export function SceneVisual({ id, words, title }: { id: VisualId; words: string[]; title: string }) {
  return (
    <svg className="scene-visual" viewBox="0 0 320 220" role="img" aria-label={`Illustration: ${id}`}>
      {VISUALS[id]({ words, title })}
    </svg>
  );
}

export const VISUAL_COUNT = Object.keys(VISUALS).length;
