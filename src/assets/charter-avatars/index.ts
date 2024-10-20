// src/assets/icons/index.ts
const importAll = async (r: Record<string, () => Promise<any>>) => {
    let images: { [key: string]: string } = {};
    for (const path in r) {
        const module = await r[path]();
        const basename = path.replace(/^.*[\\/]/, "").replace(/\.[^/.]+$/, "");
        images[basename] = module.default;
    }
    return images;
};

let charterAvatars: { [key: string]: string };

(async () => {
    charterAvatars = await importAll(import.meta.glob("./*.png"));
})();

export { charterAvatars };