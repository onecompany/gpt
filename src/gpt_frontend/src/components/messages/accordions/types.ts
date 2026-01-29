export type AccordionType = "reasoning" | "sources";

export interface BaseAccordionProps {
  type: AccordionType;
  defaultExpanded?: boolean;
  className?: string;
}

export interface ReasoningAccordionProps extends BaseAccordionProps {
  type: "reasoning";
  content: string;
  finishedLabel?: string;
}

export interface SourcesAccordionProps extends BaseAccordionProps {
  type: "sources";
  definitions: Map<string, string>;
}

export type ContentAccordionProps =
  | ReasoningAccordionProps
  | SourcesAccordionProps;
