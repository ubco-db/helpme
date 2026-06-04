// This is here since the photoswipe-dynamic-caption-plugin is missing type declarations and it's a little nicer than just plopping @ts-ignore in a few spots inside ImageCarousel
declare module 'photoswipe-dynamic-caption-plugin' {
  import PhotoSwipeLightbox from 'photoswipe/lightbox'

  export interface DynamicCaptionOptions {
    type?: 'auto' | 'aside' | 'below'
    captionContent?: string | ((slide: any) => string | HTMLElement | null)
    mobileLayoutBreakpoint?: number
    mobileCaptionOverlapRatio?: number
  }

  export default class PhotoSwipeDynamicCaption {
    constructor(lightbox: PhotoSwipeLightbox, options?: DynamicCaptionOptions)
  }
}
