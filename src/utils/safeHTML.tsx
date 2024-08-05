import DOMPurify from "dompurify";

export const renderSafeHTML = (html: string) => {
  return { __html: DOMPurify.sanitize(html) };
};