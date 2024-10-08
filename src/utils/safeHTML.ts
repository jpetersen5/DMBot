import DOMPurify from "dompurify";

export const renderSafeHTML = (html: string) => {
  const config = {
    ADD_ATTR: ["style"],
    ADD_TAGS: ["span"],
  };
  return { __html: DOMPurify.sanitize(html, config) };
};

export const stripHTML = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

export const processColorTags = (content: string) => {
  const processedContent = content.replace(/<color=(#[0-9A-Fa-f]{3,6})>(.*?)<\/color>/g, (match, color, text) => {
        if (!color || !text) {
          console.log("Invalid color tag", match);
          return text;
        }
        const fullColor = color.length === 4 
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` 
          : color;
        return `<span style="color:${fullColor}">${text}</span>`;
      }
    );
  
  return processedContent;
};

export const capitalize = (str: string, all: boolean = false) => {
  if (all) {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};
