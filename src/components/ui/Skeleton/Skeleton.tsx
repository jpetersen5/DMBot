import type { CSSProperties, FC } from "react";
import styles from "./Skeleton.module.scss";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

const toCss = (value: string | number | undefined) =>
  typeof value === "number" ? `${value}px` : value;

const Skeleton: FC<SkeletonProps> = ({ width, height, radius, circle, className, style }) => (
  <span
    className={[styles.skeleton, className].filter(Boolean).join(" ")}
    style={{
      width: toCss(width),
      height: toCss(height),
      borderRadius: circle ? "50%" : toCss(radius),
      ...style,
    }}
  />
);

export default Skeleton;
