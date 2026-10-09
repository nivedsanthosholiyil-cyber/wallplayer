import { useId } from 'react'

/** Render the supplied transparent logo; recolor its bow without tinting the face. */
export function HelloKittyArtwork({ size, playing, className = '' }: { size: number; playing?: boolean; className?: string }) {
  const filterId = `kitty-bow-${useId().replace(/:/g, '')}`
  return <svg className={`theme-art kitty-face ${className}`} data-playing={Boolean(playing)} width={size} height={size} viewBox="450 20 2940 2100" aria-hidden="true">
    <defs><filter id={filterId} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  .55 .45 0 0 0  .7 -.7 1 0 0  0 0 0 1 0" /></filter></defs>
    <image href="/themes/hello-kitty/hello-kitty.png" width="3840" height="2160" filter={playing ? `url(#${filterId})` : undefined} />
  </svg>
}

export function KittyBow({ direction }: { direction?: 'previous' | 'next' }) {
  return <>
    <path className="kitty-bow__ribbon" d="M21 20 9 12C4 9 3 14 5 24c-2 10-1 15 4 12l12-8m6-8 12-8c5-3 6 2 4 12 2 10 1 15-4 12l-12-8Z" strokeWidth="1.6" strokeLinejoin="round" />
    <ellipse className="kitty-bow__knot" cx="24" cy="24" rx="5" ry="6" />
    {direction && <path d={direction === 'previous' ? 'm25.5 21-3 3 3 3' : 'm22.5 21 3 3-3 3'} fill="none" stroke="#fff6f8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
  </>
}
