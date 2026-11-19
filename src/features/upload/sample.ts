/** Geometric "LOGO" wordmark. Letterforms are paths, so it rasterizes the same on every machine. */
export const SAMPLE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g fill="#161616">
    <path d="M36 160h26v150h74v26H36z"/>
    <path fill-rule="evenodd" d="M148 160h96v176h-96zm26 26v124h44V186z"/>
    <path fill-rule="evenodd" d="M260 160h96v176h-96zM356 186h-70v40h70zM286 252h44v58h-44z"/>
    <path fill-rule="evenodd" d="M372 160h96v176h-96zm26 26v124h44V186z"/>
  </g>
</svg>`

export function sampleLogoBlob() {
  return new Blob([SAMPLE_LOGO_SVG], { type: 'image/svg+xml' })
}
