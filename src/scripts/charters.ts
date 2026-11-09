const CHAR_DELIMITERS = [",", "/", "&"];
const MULTICHAR_DELIMITERS = [" - ", " + ", " and "];

const stripTags = (text: string): string => {
  let previous;
  do {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  } while (text !== previous);
  return text;
};

export function splitCharters(charterString: string): string[] {
  const text = stripTags(charterString);
  const result: string[] = [];
  let current = "";
  let i = 0;

  const flush = () => {
    if (current.trim()) result.push(current.trim());
    current = "";
  };

  while (i < text.length) {
    const multi = MULTICHAR_DELIMITERS.find(delim => text.startsWith(delim, i));
    if (multi) {
      flush();
      i += multi.length;
    } else if (CHAR_DELIMITERS.includes(text[i])) {
      flush();
      i++;
    } else {
      current += text[i++];
    }
  }
  flush();
  return result;
}
