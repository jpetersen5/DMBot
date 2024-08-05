import DOMPurify from "dompurify";

export const renderSafeHTML = (html: string) => {
  const config = {
    ADD_ATTR: ["style"],
    ADD_TAGS: ["color"],
  };
  return { __html: DOMPurify.sanitize(html, config) };
};

export const stripHTML = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};