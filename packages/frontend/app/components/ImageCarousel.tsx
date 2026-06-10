'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import Image, { StaticImageData } from 'next/image'
import { Carousel } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
// @ts-expect-error - photoswipe-dynamic-caption-plugin has no type declarations
import PhotoSwipeDynamicCaptionRaw from 'photoswipe-dynamic-caption-plugin'

import 'photoswipe/dist/photoswipe.css'
import 'photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css'
import { CarouselRef } from 'antd/lib/carousel'
import styles from './ImageCarousel.module.css'
import { cn } from '../utils/generalUtils'

interface DynamicCaptionOptions {
  type?: 'auto' | 'aside' | 'below'
  captionContent?: string | ((slide: any) => string | HTMLElement | null)
  mobileLayoutBreakpoint?: number
  mobileCaptionOverlapRatio?: number
}

const PhotoSwipeDynamicCaption = PhotoSwipeDynamicCaptionRaw as new (
  lightbox: PhotoSwipeLightbox,
  options?: DynamicCaptionOptions,
) => any

interface CustomArrowProps {
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

function PrevArrow({ className, style, onClick }: CustomArrowProps) {
  return (
    <button
      type="button"
      className={className}
      style={{ ...style }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label="Previous slide"
    >
      <LeftOutlined />
    </button>
  )
}

function NextArrow({ className, style, onClick }: CustomArrowProps) {
  return (
    <button
      type="button"
      className={className}
      style={{ ...style }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label="Next slide"
    >
      <RightOutlined />
    </button>
  )
}

export interface CarouselImageItem {
  src: string | StaticImageData
  alt: string
  caption?: ReactNode
  width?: number
  height?: number
}

interface ImageCarouselProps {
  images: CarouselImageItem[]
}

export default function ImageCarousel({ images }: ImageCarouselProps) {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null)
  const carouselRef = useRef<CarouselRef | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({})

  // Automatically fetch natural width/height for string URLs if not provided
  useEffect(() => {
    images.forEach((img) => {
      if (typeof img.src === 'string' && (!img.width || !img.height)) {
        const srcStr = img.src
        const tempImg = new window.Image()
        tempImg.src = srcStr
        tempImg.onload = () => {
          setDimensions((prev) => ({
            ...prev,
            [srcStr]: {
              width: tempImg.naturalWidth,
              height: tempImg.naturalHeight,
            },
          }))
        }
      }
    })
  }, [images])

  // Initialize PhotoSwipe Lightbox
  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      // needs this otherwise opening lightbox -> clicking next/prev -> close will cause it to jump to the top of the page
      // since antd's carousel seems to move not-in-focus images into the topmost carousel (or someplace weird in the dom and the browser gets confused)
      returnFocus: false,
      paddingFn: (viewportSize) => {
        return {
          top: 30,
          bottom: 30,
          left: viewportSize.x < 600 ? 0 : 70,
          right: viewportSize.x < 600 ? 0 : 70,
        }
      },
    })

    // Setup the Dynamic Caption Plugin
    new PhotoSwipeDynamicCaption(lightbox, {
      type: 'auto',
      captionContent: (slide) => {
        const index = slide.index
        const container = containerRef.current
          ? containerRef.current.querySelector(`.pswp-caption-source-${index}`)
          : null
        return container ? container.innerHTML : slide.data.alt || ''
      },
    })

    // Listen to slide change inside PhotoSwipe to sync it back to the carousel
    lightbox.on('change', () => {
      const currentIndex = lightbox.pswp?.currIndex
      if (typeof currentIndex === 'number' && carouselRef.current) {
        carouselRef.current.goTo(currentIndex, true)
      }
    })

    lightbox.init()
    lightboxRef.current = lightbox

    return () => {
      lightbox.destroy()
      lightboxRef.current = null
    }
  }, [images])

  const getSlideData = (img: CarouselImageItem) => {
    if (typeof img.src !== 'string') {
      return {
        src: img.src.src,
        width: img.width || img.src.width,
        height: img.height || img.src.height,
      }
    } else {
      const srcStr = img.src
      return {
        src: srcStr,
        width: img.width || dimensions[srcStr]?.width || 1200,
        height: img.height || dimensions[srcStr]?.height || 800,
      }
    }
  }

  const openLightbox = (index: number, clickedFigure: HTMLElement) => {
    if (!lightboxRef.current) return

    const originalSlides = containerRef.current
      ? containerRef.current.querySelectorAll(
          '.ant-carousel .slick-slide:not(.slick-cloned) figure',
        )
      : []

    const dataSource = images.map((img, idx) => {
      const slideData = getSlideData(img)
      const element =
        idx === index
          ? clickedFigure
          : (originalSlides[idx] as HTMLElement) || undefined

      return {
        src: slideData.src,
        msrc: slideData.src,
        w: slideData.width,
        h: slideData.height,
        width: slideData.width,
        height: slideData.height,
        alt: img.alt,
        element: element,
      }
    })

    lightboxRef.current.loadAndOpen(index, dataSource)
  }

  const tallestAspectRatio = (() => {
    if (images.length === 0) return 16 / 9
    const ratios = images.map((img) => {
      const data = getSlideData(img)
      return data.width && data.height ? data.width / data.height : 16 / 9
    })
    return Math.min(...ratios)
  })()

  return (
    <div
      ref={containerRef}
      className={cn(
        styles.container,
        'max-h-[400px] w-full min-w-0 overflow-hidden md:flex-1',
      )}
    >
      <Carousel
        ref={carouselRef}
        arrows
        prevArrow={<PrevArrow />}
        nextArrow={<NextArrow />}
        infinite={true}
        className="text-helpmeblue rounded-sm border-2 border-[#f8f9fb]"
        draggable={true}
      >
        {images.map((img, index) => {
          const slideData = getSlideData(img)
          return (
            <div key={`${index}-${img.src}`} className="outline-none">
              <figure
                className="relative m-0 flex w-full cursor-pointer select-none flex-col items-center justify-center bg-white p-0"
                style={{ aspectRatio: tallestAspectRatio }}
                onClick={(e) => openLightbox(index, e.currentTarget)}
              >
                {typeof img.src === 'string' ? (
                  <Image
                    src={img.src}
                    alt={img.alt}
                    width={slideData.width}
                    height={slideData.height}
                    className="h-full w-full object-contain"
                    priority={index === 0}
                  />
                ) : (
                  <Image
                    src={img.src}
                    alt={img.alt}
                    className="h-full w-full object-contain"
                    priority={index === 0}
                  />
                )}
                {/* Semantic figcaption container for screenreaders, visually hidden on page */}
                {img.caption && (
                  <figcaption
                    className={`pswp-caption-source-${index} sr-only`}
                  >
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            </div>
          )
        })}
      </Carousel>
    </div>
  )
}
