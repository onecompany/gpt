import React, { useRef, useEffect } from "react";
import { useInView, animate } from "framer-motion";

export const AnimatedCounter: React.FC<{
  value: number;
  suffix?: string | React.ReactNode;
  prefix?: string | React.ReactNode;
  decimals?: number;
}> = ({ value, suffix = "", prefix = "", decimals = 0 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (isInView && ref.current) {
      const node = ref.current;
      const controls = animate(0, value, {
        duration: 2,
        onUpdate(latest) {
          node.textContent = latest.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
        },
      });
      // Set the final precise value on completion to avoid floating point inaccuracies from the animation.
      controls.then(() => {
        node.textContent = value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      });
      return () => controls.stop();
    }
  }, [isInView, value, decimals]);

  return (
    <span>
      {prefix}
      <span ref={ref}>
        {value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </span>
      {suffix}
    </span>
  );
};
