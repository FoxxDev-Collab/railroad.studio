const XLINK = 'http://www.w3.org/1999/xlink';

export type MapImageOptions = {
    /** Painted behind the map, which is otherwise transparent. */
    background: string;
    /** 'view' is what is on screen now. The others fit the whole map into the image. */
    kind: 'view' | 'whole' | 'svg';
    /** For 'whole': the length of the longer side, in pixels. For 'view': how many pixels per screen pixel. */
    size: number;
};

/**
 * The rules from this app's own stylesheet, which colour the map. Other
 * stylesheets are on another origin and cannot be read, and are not needed.
 * @return {string}
 */
function mapStyles(): string {
    const rules: string[] = [];
    for (const sheet of document.styleSheets) {
        if (!sheet.href?.endsWith('/style.css')) continue;
        for (const rule of sheet.cssRules) rules.push(rule.cssText);
    }
    return rules.join('\n');
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Could not read an image'));
        reader.readAsDataURL(blob);
    });
}

/**
 * A picture cannot load other files, so files the map refers to, such as the
 * terrain background, are copied into it.
 * @param {SVGElement} root
 */
async function inlineImages(root: SVGElement): Promise<void> {
    const loaded = new Map<string, string>();
    for (const image of root.querySelectorAll('image')) {
        const href = image.getAttribute('href') ?? image.getAttributeNS(XLINK, 'href');
        if (!href || href.startsWith('data:')) continue;
        let data = loaded.get(href);
        if (!data) {
            const response = await fetch(href);
            if (!response.ok) throw new Error(`Could not load ${href}`);
            data = await blobToDataUrl(await response.blob());
            loaded.set(href, data);
        }
        image.removeAttributeNS(XLINK, 'href');
        image.setAttribute('href', data);
    }
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('The browser could not draw the map as an image'));
        image.src = url;
    });
}

/**
 * Make a picture of the map: a PNG of the current view or of the whole map,
 * or the whole map as an SVG. Layers that are switched off are left out.
 * @param {SVGSVGElement} svg - The map as it is on screen. It is not changed.
 * @param {MapImageOptions} options
 * @return {Promise<Blob>}
 */
export async function mapImage(svg: SVGSVGElement, options: MapImageOptions): Promise<Blob> {
    const liveViewport = svg.querySelector<SVGGElement>('g.svg-pan-zoom_viewport');
    if (!liveViewport) throw new Error('The map has not been drawn yet');
    // Measure before copying: a copy that is not on the page has no size
    const bounds = liveViewport.getBBox();
    const copy = svg.cloneNode(true) as SVGSVGElement;
    const viewport = copy.querySelector<SVGGElement>('g.svg-pan-zoom_viewport');
    if (!viewport) throw new Error('The map has not been drawn yet');
    // Leave out what is switched off. It can be most of the map (every tree, for one).
    copy.querySelectorAll<SVGElement>('[style*="display"]').forEach((element) => {
        if (element.style.display === 'none') element.remove();
    });
    let width = svg.clientWidth;
    let height = svg.clientHeight;
    let pixels = options.size;
    if (options.kind !== 'view') {
        if (bounds.width <= 0 || bounds.height <= 0) throw new Error('There is nothing on the map to draw');
        const scale = options.size / Math.max(bounds.width, bounds.height);
        width = Math.round(bounds.width * scale);
        height = Math.round(bounds.height * scale);
        pixels = 1;
        viewport.removeAttribute('style');
        viewport.setAttribute('transform', `matrix(${scale} 0 0 ${scale} ${-bounds.x * scale} ${-bounds.y * scale})`);
    }
    // The page positions the map with this class; a picture is sized by its own attributes
    copy.removeAttribute('class');
    copy.removeAttribute('style');
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(height));
    copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
    // The colours are CSS variables that depend on the theme
    const theme = document.documentElement.getAttribute('data-bs-theme');
    if (theme) copy.setAttribute('data-bs-theme', theme);
    const style = document.createElementNS(svg.namespaceURI, 'style');
    style.textContent = mapStyles();
    const backdrop = document.createElementNS(svg.namespaceURI, 'rect');
    backdrop.setAttribute('width', '100%');
    backdrop.setAttribute('height', '100%');
    backdrop.setAttribute('fill', options.background);
    copy.prepend(style, backdrop);
    await inlineImages(copy);
    const text = new XMLSerializer().serializeToString(copy);
    const svgBlob = new Blob([text], {type: 'image/svg+xml;charset=utf-8'});
    if (options.kind === 'svg') return svgBlob;
    const url = URL.createObjectURL(svgBlob);
    try {
        const image = await loadImage(url);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * pixels);
        canvas.height = Math.round(height * pixels);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('The browser could not make an image this large');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('The browser could not make an image this large')),
            'image/png'));
    } finally {
        URL.revokeObjectURL(url);
    }
}
