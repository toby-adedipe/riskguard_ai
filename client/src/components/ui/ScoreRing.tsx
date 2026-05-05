interface ScoreRingProps {
  score: number;
  size?: number;
}

function getColor(score: number) {
  if (score >= 75) return "#D13438";
  if (score >= 55) return "#FF8C00";
  if (score >= 35) return "#C19C00";
  return "#107C10";
}

export default function ScoreRing({ score, size = 80 }: ScoreRingProps) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = getColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E6E3" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span
        className="absolute font-mono font-bold leading-none"
        style={{ color, fontSize: size * 0.22 }}
      >
        {score}
      </span>
    </div>
  );
}
