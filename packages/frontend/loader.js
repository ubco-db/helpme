'use client';

// This is our custom image loader for Next.js
// An image loader takes a relative image URL and gives the final image URL
// This is needed since next.js creates images of different sizes for different screen resolutions and can return the right one
export default function customImageLoader({ src, width, quality }) {
    if (src.startsWith('http')) {
        // Next requires the returned URL to reflect `width` when using a custom loader.
        const q = quality ?? 75;
        const join = src.includes('?') ? '&' : '?';
        return `${src}${join}w=${width}&q=${q}`;
    } else {
        if (src.startsWith('/')) {
            // trim off any starting /
            src = src.slice(1);
        }
        const baseURL = process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' ? `http://${process.env.NEXT_PUBLIC_HOSTNAME}:${process.env.NEXT_PUBLIC_DEV_PORT}` : `https://${process.env.NEXT_PUBLIC_HOSTNAME}`;
        return `${baseURL}/${src}?w=${width}&q=${quality || 75}`;
    }
}