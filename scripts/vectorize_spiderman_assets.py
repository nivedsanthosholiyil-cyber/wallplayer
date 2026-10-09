"""Trace existing local theme silhouettes into SVG without changing their design.

The original PNGs stay intact. Pillow and NumPy are only used to read pixels;
the output is vector paths with less than one source pixel of simplification.
"""
from pathlib import Path
import numpy as np
from PIL import Image


def simplify(points, tolerance=.7):
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1])
    samples = np.array(points)
    delta = b - a
    length = np.linalg.norm(delta)
    distance = np.linalg.norm(samples - a, axis=1) if length == 0 else np.abs(delta[0] * (samples[:, 1] - a[1]) - delta[1] * (samples[:, 0] - a[0])) / length
    index = int(distance.argmax())
    if distance[index] <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def trace(binary):
    edges = {}
    padded = np.pad(binary, 1)
    boundaries = [
        (~padded[:-2, 1:-1], (0, 0), (1, 0)),
        (~padded[1:-1, 2:], (1, 0), (1, 1)),
        (~padded[2:, 1:-1], (1, 1), (0, 1)),
        (~padded[1:-1, :-2], (0, 1), (0, 0)),
    ]
    for neighbor, start, end in boundaries:
        for y, x in zip(*np.where(binary & neighbor)):
            a = (int(x) + start[0], int(y) + start[1])
            b = (int(x) + end[0], int(y) + end[1])
            edges.setdefault(a, []).append(b)
    paths = []
    while edges:
        start = next(iter(edges))
        points = [start]
        current = start
        while current in edges:
            next_point = edges[current].pop()
            if not edges[current]:
                del edges[current]
            points.append(next_point)
            current = next_point
            if current == start:
                break
        if len(points) < 8:
            continue
        reduced = simplify(points)
        paths.append('M' + 'L'.join(f'{x},{y}' for x, y in reduced) + 'Z')
    return ''.join(paths)


def svg(width, height, layers):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">' + ''.join(f'<path fill="{color}" fill-rule="evenodd" d="{trace(mask)}"/>' for color, mask in layers) + '</svg>\n'


if __name__ == '__main__':
    directory = Path(__file__).resolve().parents[1] / 'public/themes/spider-man'
    mask = np.array(Image.open(directory / 'mask-paused.png').convert('RGBA'))
    opaque = mask[:, :, 3] >= 128
    eyes = opaque & (mask[:, :, 0] > 150) & (mask[:, :, 1] > 100)
    ink = opaque & ~eyes & (mask[:, :, :3].mean(axis=2) > 20)
    for state, face, web, eye in [('paused', '#050609', '#444a54', '#ffd83f'), ('playing', '#ca1f2f', '#050609', '#fcfcfd')]:
        (directory / f'mask-{state}.svg').write_text(svg(mask.shape[1], mask.shape[0], [(face, opaque), (web, ink), (eye, eyes)]), encoding='utf-8')
    spider = np.array(Image.open(directory / 'progress-spider.png').convert('RGBA'))
    for name, color in [('progress-spider', '#e13340'), ('spider-paused', '#050609')]:
        (directory / f'{name}.svg').write_text(svg(spider.shape[1], spider.shape[0], [(color, spider[:, :, 3] >= 128)]), encoding='utf-8')
