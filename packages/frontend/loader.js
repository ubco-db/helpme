'use client';

// This is our custom image loader for Next.js
// An image loader takes a relative image URL and gives the final image URL
// This is needed since next.js creates images of different sizes for different screen resolutions and can return the right one
export default function customImageLoader({ src, width, quality }) {
    if (src.startsWith('http')) {
        // external URL image (e.g. to google)
        return src;
    } else {
        if (src.startsWith('/')) {
            // trim off any starting /
            src = src.slice(1);
        }
        const baseURL = process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' ? `http://${process.env.NEXT_PUBLIC_HOSTNAME}:${process.env.NEXT_PUBLIC_DEV_PORT}` : `https://${process.env.NEXT_PUBLIC_HOSTNAME}`;
        return `${baseURL}/${src}?w=${width}&q=${quality || 75}`;
    }
}