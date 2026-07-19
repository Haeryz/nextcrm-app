import React, { type CSSProperties } from "react";

const PARTICLE_COUNT = 18;
const PARTICLE_COLORS = [
  "hsl(var(--primary))",
  "#38bdf8",
  "#22c55e",
  "#facc15",
] as const;

type ConfettiParticleStyle = CSSProperties & {
  "--confetti-color": string;
  "--confetti-delay": string;
  "--confetti-rotation-end": string;
  "--confetti-rotation-mid": string;
  "--confetti-x-end": string;
  "--confetti-x-mid": string;
  "--confetti-y-end": string;
  "--confetti-y-mid": string;
};

const particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const distance = 42 + (index % 4) * 9;
  const xMid = Math.cos(angle) * distance;
  const yMid = Math.sin(angle) * distance - 32;
  const rotation = 180 + ((index * 47) % 300);

  return {
    color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
    delay: (index % 4) * 18,
    rotation,
    xEnd: xMid * 1.2,
    xMid,
    yEnd: yMid + 52 + (index % 3) * 8,
    yMid,
  };
});

export function ServiceCreatedBurst() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-14 top-1/2 z-20 block size-0 overflow-visible motion-reduce:hidden"
    >
      <span className="mektek-success-ring absolute -left-3 -top-3 size-6 rounded-full border border-primary/60" />
      {particles.map((particle, index) => {
        const style: ConfettiParticleStyle = {
          "--confetti-color": particle.color,
          "--confetti-delay": `${particle.delay}ms`,
          "--confetti-rotation-end": `${particle.rotation}deg`,
          "--confetti-rotation-mid": `${particle.rotation / 2}deg`,
          "--confetti-x-end": `${particle.xEnd}px`,
          "--confetti-x-mid": `${particle.xMid}px`,
          "--confetti-y-end": `${particle.yEnd}px`,
          "--confetti-y-mid": `${particle.yMid}px`,
        };

        return (
          <span
            key={`${particle.xMid}-${particle.yMid}`}
            data-confetti-particle="true"
            className={
              index % 3 === 0
                ? "mektek-success-confetti absolute -left-0.5 -top-0.5 size-1.5 rounded-full"
                : "mektek-success-confetti absolute -left-0.5 -top-0.5 h-1.5 w-1 rounded-[2px]"
            }
            style={style}
          />
        );
      })}
    </span>
  );
}
