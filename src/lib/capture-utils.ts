/**
 * Screenshot capture utility using html-to-image.
 *
 * html-to-image works by cloning the DOM, inlining computed styles,
 * embedding resources as data URLs, then rendering via SVG foreignObject.
 * Unlike html2canvas, it doesn't have its own CSS parser, so it supports
 * modern color functions (oklch, lab, oklab) used by Tailwind CSS v4.
 */

import { toPng, toBlob } from 'html-to-image';

export interface CaptureOptions {
  /** Pixel scale factor (default: 2 for retina) */
  scale?: number;
  /** Background color to fill behind the element (e.g. '#0a0a0f') */
  backgroundColor?: string;
}

/**
 * Capture a DOM element as a PNG data URL.
 */
export async function captureElementAsDataUrl(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<string> {
  const { scale = 2, backgroundColor } = options;

  return toPng(element, {
    pixelRatio: scale,
    backgroundColor: backgroundColor ?? undefined,
    cacheBust: true,
    skipAutoScale: true,
  });
}

/**
 * Capture a DOM element as a PNG Blob.
 */
export async function captureElementAsBlob(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<Blob> {
  const { scale = 2, backgroundColor } = options;

  const blob = await toBlob(element, {
    pixelRatio: scale,
    backgroundColor: backgroundColor ?? undefined,
    cacheBust: true,
    skipAutoScale: true,
  });

  if (!blob) throw new Error('Failed to create PNG blob');
  return blob;
}
