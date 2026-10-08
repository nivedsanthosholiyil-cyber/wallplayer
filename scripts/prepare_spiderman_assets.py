"""Prepare transparent UI assets from the supplied screenshots, preserving their artwork."""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def regions(binary):
    height, width = binary.shape
    labels = np.full((height, width), -1, dtype=int)
    components = []
    for y in range(height):
        for x in range(width):
            if not binary[y, x] or labels[y, x] >= 0:
                continue
            label = len(components)
            pending = deque([(y, x)])
            labels[y, x] = label
            count = 0
            touches_edge = False
            while pending:
                cy, cx = pending.popleft()
                count += 1
                touches_edge |= cy in (0, height - 1) or cx in (0, width - 1)
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and binary[ny, nx] and labels[ny, nx] < 0:
                        labels[ny, nx] = label
                        pending.append((ny, nx))
            components.append((count, touches_edge))
    return labels, components


def prepare_mask(source, destination):
    # Exclude the browser/screenshot frame; the original mask linework remains untouched.
    image = Image.open(source).convert('RGB').crop((12, 8, 368, 510))
    gray = np.asarray(image).mean(axis=2)
    labels, components = regions(gray >= 145)
    outside_labels = [index for index, (_, edge) in enumerate(components) if edge]
    foreground = ~np.isin(labels, outside_labels)
    eye_labels = sorted((index for index, (_, edge) in enumerate(components) if not edge),
                        key=lambda index: components[index][0], reverse=True)[:2]
    eyes = np.isin(labels, eye_labels)
    for state, face, ink, eye in (
        ('paused', (5, 6, 9), (41, 44, 51), (255, 216, 63)),
        ('playing', (202, 31, 47), (5, 6, 9), (252, 252, 253)),
    ):
        fill = np.zeros((*gray.shape, 3), dtype=float)
        fill[:] = face
        fill[eyes] = eye
        # Keep the original antialiased black ink and every web strand.
        ink_fraction = np.clip(1 - gray / 255, 0, 1)[..., None]
        rgb = fill * (1 - ink_fraction) + np.asarray(ink) * ink_fraction
        rgba = np.dstack((rgb.astype('uint8'), (foreground * 255).astype('uint8')))
        result = Image.fromarray(rgba)
        result = result.crop(result.getbbox())
        result.save(destination / f'mask-{state}.png')
    print('Eye component areas:', [components[index][0] for index in eye_labels])


def prepare_spider(source, destination):
    image = Image.open(source).convert('RGB').crop((4, 0, 260, 325))
    gray = np.asarray(image).mean(axis=2)
    # Turn the original white screenshot background into alpha; retain the exact silhouette.
    alpha = 255 - gray
    rgba = np.zeros((*gray.shape, 4), dtype='uint8')
    rgba[..., :3] = (225, 51, 64)
    rgba[..., 3] = alpha.astype('uint8')
    result = Image.fromarray(rgba)
    result = result.crop(result.getbbox())
    result.save(destination / 'progress-spider.png')
    paused = np.array(result)
    paused[..., :3] = (5, 6, 9)
    Image.fromarray(paused).save(destination / 'spider-paused.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mask')
    parser.add_argument('spider')
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prepare_mask(args.mask, args.output)
    prepare_spider(args.spider, args.output)
