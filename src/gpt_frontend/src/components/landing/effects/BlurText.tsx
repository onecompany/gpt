import React, { useRef } from "react";
import clsx from "clsx";
import { motion, useInView } from "framer-motion";

export const BlurText: React.FC<{
  text: string;
  className?: string;
  delay?: number;
  as?: "h2" | "p";
}> = ({ text, className, delay = 100, as = "h2" }) => {
  const elements = text.split(" ");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const variants = {
    hidden: { filter: "blur(10px)", opacity: 0, y: 20 },
    visible: { filter: "blur(0px)", opacity: 1, y: 0 },
  };
  const MotionComponent = motion[as];
  return (
    <MotionComponent ref={ref} className={clsx("flex flex-wrap", className)}>
      {elements.map((segment, index) => (
        <motion.span
          key={index}
          className="inline-block mr-1"
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          transition={{
            duration: 0.5,
            delay: inView ? index * (delay / 1000) : 0,
            ease: "easeOut",
          }}
          variants={variants}
        >
          {segment}
        </motion.span>
      ))}
    </MotionComponent>
  );
};
