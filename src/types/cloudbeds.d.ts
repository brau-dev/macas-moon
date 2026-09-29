import type { DetailedHTMLProps, HTMLAttributes } from "react";

type CloudbedsElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  "property-code": string;
  "button-label"?: string;
  "class-name"?: string;
  currency?: string;
  lang?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cb-property-date-picker": CloudbedsElementProps & {
        layout?: "horizontal" | "vertical";
        "open-in-new-tab"?: "true" | "false";
      };
      "cb-accommodation-date-picker": CloudbedsElementProps & {
        rid: string;
      };
    }
  }
}

export {};
