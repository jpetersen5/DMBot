import type { FC, SVGProps } from "react";

export type SvgComponent = FC<SVGProps<SVGSVGElement>>;

interface IconProps extends SVGProps<SVGSVGElement> {
  as: SvgComponent;
  title?: string;
}

const Icon: FC<IconProps> = ({ as: Svg, title, className, ...rest }) => (
  <Svg
    className={["icon-svg", className].filter(Boolean).join(" ")}
    focusable="false"
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    aria-label={title}
    {...rest}
  />
);

export default Icon;
